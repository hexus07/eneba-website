<?php

namespace App\Services\Checkout;

use App\Enums\OrderStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\User;
use App\Services\Cart\CartService;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\PaymentGatewayException;
use App\Services\Payments\PaymentSession;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Cart → pending order → payment session. Keys are NOT touched here; they are assigned only once the
 * payment succeeds (OrderFulfiller). Stock is checked here so buyers can't pay for what's visibly gone.
 */
class CheckoutService
{
    public function __construct(
        private readonly CartService $cart,
        private readonly PaymentGateway $gateway,
    ) {}

    /** @return array{0: Order, 1: ?PaymentSession} */
    public function checkout(User $user, ?string $idempotencyKey): array
    {
        if ($idempotencyKey !== null && $existing = $user->orders()->where('idempotency_key', $idempotencyKey)->first()) {
            return $this->resume($existing);
        }

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
            $order = DB::transaction(fn () => $this->createOrder($user, $items, $idempotencyKey));
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

    /** @return array{0: Order, 1: ?PaymentSession} */
    private function resume(Order $order): array
    {
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
