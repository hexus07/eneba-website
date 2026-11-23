<?php

namespace App\Services\Checkout;

use App\Enums\KeyStatus;
use App\Enums\OrderStatus;
use App\Models\CartItem;
use App\Models\Offer;
use App\Models\Order;
use App\Models\ProductKey;
use App\Services\Payments\PaymentGateway;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use LogicException;

/**
 * Turns a successful payment into delivered keys. Safe to call any number of times, concurrently,
 * for the same order (duplicate webhooks, webhook + manual confirm): the order row lock plus the
 * `pending` check make every call after the first a no-op.
 */
class OrderFulfiller
{
    public function __construct(private readonly PaymentGateway $gateway) {}

    public function markPaid(Order $order): Order
    {
        try {
            $order = DB::transaction(fn () => $this->assignKeys($order));
            if ($order->status === OrderStatus::Completed) {
                $this->deactivateSoldOutOffers($order->items->pluck('offer_id')->unique()->all());
            }
        } catch (InsufficientStock $e) {
            // The whole assignment rolled back, so no keys are held. All-or-nothing: a partial order
            // would leave the buyer charged for keys they didn't get.
            Log::warning('Order paid but out of stock; refunding', ['order_id' => $order->id, 'offer_id' => $e->offerId]);
            $order = $this->claimForRefund($order);
        }

        // Also reached on a retry (webhook redelivery) after a refund call failed earlier.
        return $order->status === OrderStatus::Refunding ? $this->completeRefund($order) : $order;
    }

    public function markFailed(Order $order, string $reason): Order
    {
        return DB::transaction(function () use ($order, $reason) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($order->isPending()) {
                $order->update(['status' => OrderStatus::Failed, 'failure_reason' => $reason]);
            }

            return $order;
        });
    }

    private function assignKeys(Order $order): Order
    {
        // Serializes fulfillment of THIS order; other orders proceed in parallel.
        $order = Order::query()->whereKey($order->id)->lockForUpdate()->with('items')->firstOrFail();
        if (! $order->isPending()) {
            return $order; // already fulfilled / refunded / failed
        }

        foreach ($order->items as $item) {
            // FOR UPDATE SKIP LOCKED: concurrent buyers of the same offer each lock *different* rows
            // instead of queueing on the same ones. A key locked by another transaction is invisible
            // here, so it can never be handed to two orders.
            $keyIds = DB::table('product_keys')
                ->where('offer_id', $item->offer_id)
                ->where('status', KeyStatus::Available->value)
                ->orderBy('id')
                ->limit($item->quantity)
                ->lock('FOR UPDATE SKIP LOCKED')
                ->pluck('id');

            if ($keyIds->count() < $item->quantity) {
                throw new InsufficientStock($item->offer_id);
            }

            // Belt and braces: the status guard means a row that somehow isn't available anymore
            // is not overwritten; the count check turns that into a loud failure + rollback.
            $updated = ProductKey::query()
                ->whereIn('id', $keyIds)
                ->where('status', KeyStatus::Available)
                ->update(['status' => KeyStatus::Sold, 'order_item_id' => $item->id, 'updated_at' => now()]);
            if ($updated !== $keyIds->count()) {
                throw new LogicException("Locked keys changed under us for order {$order->id}");
            }
        }

        $order->update(['status' => OrderStatus::Completed, 'paid_at' => now(), 'fulfilled_at' => now(), 'failure_reason' => null]);

        CartItem::query()->where('user_id', $order->user_id)->whereIn('offer_id', $order->items->pluck('offer_id'))->delete();

        return $order;
    }

    /**
     * Runs AFTER the assignment commits. Inside the transaction, two buyers taking the last keys
     * concurrently would each still see the other's (uncommitted) key as available, and neither would
     * deactivate. After commit, whichever check runs last sees all prior commits.
     * Through Eloquent so OfferObserver updates the product's min price / offer count.
     */
    private function deactivateSoldOutOffers(array $offerIds): void
    {
        Offer::query()
            ->whereIn('id', $offerIds)
            ->where('is_active', true)
            ->whereDoesntHave('keys', fn ($q) => $q->where('status', KeyStatus::Available))
            ->get()
            ->each(fn (Offer $offer) => $offer->update(['is_active' => false]));
    }

    /**
     * Move pending → refunding under the row lock BEFORE calling the provider. Once claimed, no
     * concurrent markPaid can fulfill this order, so we never refund an order that got its keys.
     */
    private function claimForRefund(Order $order): Order
    {
        return DB::transaction(function () use ($order) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($order->isPending()) {
                $order->update(['status' => OrderStatus::Refunding, 'paid_at' => now(), 'failure_reason' => 'out_of_stock']);
            }

            return $order;
        });
    }

    private function completeRefund(Order $order): Order
    {
        // Outside any DB transaction: never hold row locks across a network call. If the provider
        // fails, the exception propagates (webhook → 5xx → Stripe redelivers → we land here again).
        // The refund call is idempotent per order, so retries and races can't double-refund.
        $this->gateway->refund($order);

        return DB::transaction(function () use ($order) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($order->status === OrderStatus::Refunding) {
                $order->update(['status' => OrderStatus::Refunded]);
            }

            return $order;
        });
    }
}
