<?php

namespace App\Services\Checkout;

use App\Enums\KeyStatus;
use App\Enums\OrderStatus;
use App\Models\CartItem;
use App\Models\Offer;
use App\Models\Order;
use App\Services\Payments\PaymentGateway;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Turns a payment outcome into order state. Keys were already reserved at checkout
 * (KeyReservations), so a successful payment just sells THIS order's reserved keys.
 *
 * Safe to call any number of times, concurrently, for the same order (duplicate webhooks, webhook
 * + manual confirm): the order row lock plus the status checks make every call after the first a
 * no-op.
 */
class OrderFulfiller
{
    public function __construct(
        private readonly PaymentGateway $gateway,
        private readonly KeyReservations $keys,
    ) {}

    public function markPaid(Order $order): Order
    {
        $order = DB::transaction(function () use ($order) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->with('items')->firstOrFail();

            if ($order->isPending() && ! $order->expires_at?->isPast()) {
                $this->keys->sell($order);
                $order->update(['status' => OrderStatus::Completed, 'paid_at' => now(), 'fulfilled_at' => now(), 'failure_reason' => null]);
                CartItem::query()->where('user_id', $order->user_id)->whereIn('offer_id', $order->items->pluck('offer_id'))->delete();

                return $order;
            }

            // Paid too late: the reservation lapsed (keys may be someone else's by now). Release
            // anything still held, and claim the order for a refund BEFORE calling the provider,
            // so no concurrent call can still fulfill it.
            if ($order->isPending() || $order->status === OrderStatus::Expired) {
                $this->keys->release($order);
                $order->update(['status' => OrderStatus::Refunding, 'paid_at' => now(), 'failure_reason' => 'reservation_expired']);
                Log::warning('Payment arrived after the reservation expired; refunding', ['order_id' => $order->id]);
            }

            return $order; // completed / failed / refunding / refunded: nothing (more) to do
        });

        if ($order->status === OrderStatus::Completed) {
            $this->deactivateSoldOutOffers($order->items->pluck('offer_id')->unique()->all());
        }

        // Also reached on a retry (webhook redelivery) after a refund call failed earlier.
        return $order->status === OrderStatus::Refunding ? $this->completeRefund($order) : $order;
    }

    /** Declined / canceled: the order fails and its keys go straight back on sale. */
    public function markFailed(Order $order, string $reason): Order
    {
        return DB::transaction(function () use ($order, $reason) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->with('items')->firstOrFail();
            if ($order->isPending()) {
                $this->keys->release($order);
                $order->update(['status' => OrderStatus::Failed, 'failure_reason' => $reason]);
            }

            return $order;
        });
    }

    /**
     * After commit. An offer is sold out only when it has neither available nor reserved keys:
     * reserved keys may come back when an unpaid order expires.
     * Through Eloquent so OfferObserver updates the product's min price / offer count.
     */
    private function deactivateSoldOutOffers(array $offerIds): void
    {
        Offer::query()
            ->whereIn('id', $offerIds)
            ->where('is_active', true)
            ->whereDoesntHave('keys', fn ($q) => $q->whereIn('status', [KeyStatus::Available, KeyStatus::Reserved]))
            ->get()
            ->each(fn (Offer $offer) => $offer->update(['is_active' => false]));
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
