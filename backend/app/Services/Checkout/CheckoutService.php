<?php

namespace App\Services\Checkout;

use App\Enums\OrderStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\User;
use App\Services\Cart\CartService;
use App\Services\Catalog\Stock;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\PaymentGatewayException;
use App\Services\Payments\PaymentSession;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Cart → pending order with RESERVED keys → payment session. Keys are held until the order's
 * expires_at (config checkout.reservation_minutes); payment sells them (OrderFulfiller), expiry or
 * decline releases them (KeyReservations).
 */
class CheckoutService
{
    public function __construct(
        private readonly CartService $cart,
        private readonly PaymentGateway $gateway,
        private readonly KeyReservations $keys,
        private readonly Stock $stock,
    ) {}

    /** @return array{0: Order, 1: ?PaymentSession} */
    public function checkout(User $user, ?string $idempotencyKey): array
    {
        if ($idempotencyKey !== null && $existing = $user->orders()->where('idempotency_key', $idempotencyKey)->first()) {
            return $this->resume($existing);
        }

        // Reclaim keys from abandoned orders first, so stock isn't blocked when the scheduler is
        // not running (Render free tier has no cron).
        $this->keys->expireStale();

        $items = $this->cart->items($user);
        if ($items->isEmpty()) {
            throw ValidationException::withMessages(['cart' => 'Your cart is empty.']);
        }

        $problems = $items
            ->filter(fn (CartItem $i) => $i->quantity > $i->available_stock)
            ->map(fn (CartItem $i) => [
                'offer_id' => $i->offer_id,
                'reason' => $i->offer->is_active ? 'out_of_stock' : 'unavailable',
                'requested' => $i->quantity,
                'available' => $i->available_stock,
            ])->values()->all();
        if ($problems !== []) {
            throw new OutOfStockException($problems);
        }

        try {
            $order = DB::transaction(function () use ($user, $items, $idempotencyKey) {
                $order = $this->createOrder($user, $items, $idempotencyKey);
                $this->keys->reserve($order->load('items')); // throws → whole order rolls back

                return $order;
            });
        } catch (InsufficientStock $e) {
            // Lost a race for the last keys (the pre-check above passed). No order was created.
            $item = $items->firstWhere('offer_id', $e->offerId);
            throw new OutOfStockException([[
                'offer_id' => $e->offerId,
                'reason' => 'out_of_stock',
                'requested' => $item?->quantity ?? 0,
                'available' => $this->stock->available([$e->offerId])[$e->offerId],
            ]]);
        } catch (UniqueConstraintViolationException) {
            // Concurrent double-submit with the same Idempotency-Key: the other request won.
            return $this->resume($user->orders()->where('idempotency_key', $idempotencyKey)->firstOrFail());
        }

        return $this->startPayment($order);
    }

    private function createOrder(User $user, $items, ?string $idempotencyKey): Order
    {
        $order = $user->orders()->create([
            'status' => OrderStatus::Pending,
            // Prices come from the offers as they are now, never from the client.
            'total_cents' => $items->sum(fn (CartItem $i) => $i->offer->price_cents * $i->quantity),
            'currency' => config('payments.currency'),
            'payment_provider' => $this->gateway->name(),
            'idempotency_key' => $idempotencyKey,
            'expires_at' => now()->addMinutes(config('checkout.reservation_minutes')),
        ]);

        $order->items()->createMany($items->map(fn (CartItem $i) => [
            'offer_id' => $i->offer_id,
            'product_id' => $i->offer->product_id,
            'product_title' => $i->offer->product->title,
            'platform_name' => $i->offer->product->platform->name,
            'region_name' => $i->offer->product->region->name,
            'seller_name' => $i->offer->seller->name,
            'unit_price_cents' => $i->offer->price_cents,
            'quantity' => $i->quantity,
        ])->all());

        return $order;
    }

    /**
     * The payment session of an existing order, for a payment page that was reloaded or reopened.
     * Same idempotent path as a replayed checkout: Stripe returns the SAME PaymentIntent per order.
     * Null session when the order is no longer payable (paid, failed, expired).
     *
     * @return array{0: Order, 1: ?PaymentSession}
     */
    public function paymentFor(Order $order): array
    {
        return $this->resume($order);
    }

    /** @return array{0: Order, 1: ?PaymentSession} */
    private function resume(Order $order): array
    {
        $order = $this->keys->expireIfStale($order);

        return $order->isPending() ? $this->startPayment($order) : [$order, null];
    }

    /** @return array{0: Order, 1: PaymentSession} */
    private function startPayment(Order $order): array
    {
        try {
            $session = $this->gateway->createPayment($order); // idempotent per order
        } catch (PaymentGatewayException $e) {
            $order->update(['status' => OrderStatus::Failed, 'failure_reason' => 'payment_init_failed']);
            throw $e;
        }

        if ($order->payment_ref !== $session->reference) {
            $order->update(['payment_ref' => $session->reference]);
        }

        return [$order, $session];
    }
}
