<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\PaymentEvent;
use App\Models\ProductKey;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\PaymentGatewayException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Mockery;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

class StripeWebhookTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private const SECRET = 'whsec_test_secret';

    private Order $order;

    protected function setUp(): void
    {
        parent::setUp();
        config(['payments.driver' => 'fake']); // create the order via the normal flow…
        $this->actingAsBuyer();
        $this->order = $this->checkoutOffer($this->offerWithKeys(3, 1999), 2);
        $this->order->update(['payment_provider' => 'stripe', 'payment_ref' => 'pi_test_123']); // …as Stripe would have

        config(['payments.driver' => 'stripe', 'payments.stripe.secret' => 'sk_test_x', 'payments.stripe.webhook_secret' => self::SECRET]);
    }

    private function event(string $type, array $intent = [], string $id = 'evt_1'): string
    {
        return json_encode([
            'id' => $id, 'object' => 'event', 'type' => $type, 'api_version' => '2024-06-20',
            'data' => ['object' => array_merge([
                'id' => 'pi_test_123', 'object' => 'payment_intent', 'amount' => 3998, 'amount_received' => 3998,
                'currency' => 'eur', 'status' => 'succeeded', 'metadata' => ['order_id' => $this->order->id],
            ], $intent)],
        ]);
    }

    private function deliver(string $payload, ?string $secret = self::SECRET): TestResponse
    {
        $t = time();
        $signature = 't='.$t.',v1='.hash_hmac('sha256', "{$t}.{$payload}", $secret);

        return $this->call('POST', '/api/v1/payments/stripe/webhook', [], [], [],
            ['HTTP_STRIPE_SIGNATURE' => $signature, 'CONTENT_TYPE' => 'application/json'], $payload);
    }

    public function test_rejects_bad_signature_and_garbage(): void
    {
        $this->deliver($this->event('payment_intent.succeeded'), 'whsec_wrong')->assertStatus(400);
        $this->call('POST', '/api/v1/payments/stripe/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json'], '{}')->assertStatus(400);

        $this->assertTrue($this->order->fresh()->isPending());
    }

    public function test_succeeded_event_fulfills_order(): void
    {
        $this->deliver($this->event('payment_intent.succeeded'))->assertOk()->assertJson(['received' => true]);

        $this->assertSame(OrderStatus::Completed, $this->order->fresh()->status);
        $this->assertSame(2, ProductKey::where('status', 'sold')->count());
        $this->assertNotNull(PaymentEvent::where('provider_event_id', 'evt_1')->value('processed_at'));
    }

    public function test_redelivered_event_and_duplicate_events_do_not_double_assign(): void
    {
        $payload = $this->event('payment_intent.succeeded');
        $this->deliver($payload)->assertOk();
        $this->deliver($payload)->assertOk()->assertJson(['duplicate' => true]);
        // Stripe can also send distinct events for the same intent.
        $this->deliver($this->event('payment_intent.succeeded', id: 'evt_2'))->assertOk();

        $this->assertSame(2, ProductKey::where('status', 'sold')->count());
    }

    public function test_amount_mismatch_is_not_fulfilled(): void
    {
        $this->deliver($this->event('payment_intent.succeeded', ['amount_received' => 1]))->assertOk();

        $order = $this->order->fresh();
        $this->assertSame(OrderStatus::Failed, $order->status);
        $this->assertSame('amount_mismatch', $order->failure_reason);
        $this->assertSame(0, ProductKey::where('status', 'sold')->count());
    }

    public function test_failed_attempt_keeps_order_pending_and_cancel_fails_it(): void
    {
        $this->deliver($this->event('payment_intent.payment_failed', ['status' => 'requires_payment_method', 'amount_received' => 0,
            'last_payment_error' => ['code' => 'card_declined', 'type' => 'card_error']]))->assertOk();
        $this->assertTrue($this->order->fresh()->isPending());
        $this->assertSame('card_declined', $this->order->fresh()->failure_reason);

        $this->deliver($this->event('payment_intent.canceled', ['status' => 'canceled'], 'evt_3'))->assertOk();
        $this->assertSame(OrderStatus::Failed, $this->order->fresh()->status);
    }

    public function test_out_of_stock_after_payment_refunds_through_stripe(): void
    {
        ProductKey::query()->update(['status' => 'sold']); // all keys gone between checkout and payment
        $gateway = Mockery::mock(PaymentGateway::class);
        $gateway->shouldReceive('refund')->once()->withArgs(fn (Order $o) => $o->id === $this->order->id);
        $this->app->instance(PaymentGateway::class, $gateway);

        $this->deliver($this->event('payment_intent.succeeded'))->assertOk();

        $this->assertSame(OrderStatus::Refunded, $this->order->fresh()->status);
    }

    public function test_refund_failure_returns_5xx_so_stripe_retries_and_event_is_not_marked_processed(): void
    {
        ProductKey::query()->update(['status' => 'sold']);
        $gateway = Mockery::mock(PaymentGateway::class);
        $gateway->shouldReceive('refund')->andThrow(new PaymentGatewayException('down'));
        $this->app->instance(PaymentGateway::class, $gateway);

        $this->deliver($this->event('payment_intent.succeeded'))->assertStatus(502);

        $this->assertSame(OrderStatus::Refunding, $this->order->fresh()->status);
        $this->assertNull(PaymentEvent::where('provider_event_id', 'evt_1')->value('processed_at'));
    }

    public function test_event_for_unknown_intent_is_acknowledged(): void
    {
        $this->deliver($this->event('payment_intent.succeeded', ['id' => 'pi_unknown']))->assertOk();
        $this->assertTrue($this->order->fresh()->isPending());
    }
}
