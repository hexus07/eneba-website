<?php

namespace App\Services\Payments;

use App\Models\Order;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;

/**
 * Stripe PaymentIntents (test mode). The SPA confirms the intent with Stripe Elements using
 * client_secret; the order is fulfilled by the `payment_intent.succeeded` webhook, never by the client.
 */
class StripeGateway implements PaymentGateway
{
    public function __construct(
        private readonly StripeClient $stripe,
        private readonly ?string $publishableKey,
    ) {}

    public function name(): string
    {
        return 'stripe';
    }

    public function createPayment(Order $order): PaymentSession
    {
        try {
            // Stripe idempotency key per order: a retried/replayed checkout returns the SAME intent
            // (and client_secret) instead of creating a second chargeable one.
            $intent = $this->stripe->paymentIntents->create([
                'amount' => $order->total_cents,
                'currency' => strtolower($order->currency),
                'automatic_payment_methods' => ['enabled' => true],
                'description' => "Order {$order->id}",
                'metadata' => ['order_id' => $order->id, 'user_id' => (string) $order->user_id],
            ], ['idempotency_key' => "order-{$order->id}"]);
        } catch (ApiErrorException $e) {
            report($e);
            throw new PaymentGatewayException($e->getMessage(), previous: $e);
        }

        return new PaymentSession('stripe', $intent->id, [
            'client_secret' => $intent->client_secret,
            'publishable_key' => $this->publishableKey,
        ]);
    }

    public function refund(Order $order): void
    {
        try {
            $this->stripe->refunds->create(
                ['payment_intent' => $order->payment_ref, 'reason' => 'requested_by_customer', 'metadata' => ['order_id' => $order->id]],
                ['idempotency_key' => "refund-{$order->id}"],
            );
        } catch (ApiErrorException $e) {
            report($e);
            throw new PaymentGatewayException($e->getMessage(), previous: $e);
        }
    }
}
