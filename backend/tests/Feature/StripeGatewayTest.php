<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\StripeGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Stripe\ApiRequestor;
use Stripe\HttpClient\ClientInterface;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

/** Exercises the real StripeGateway + stripe-php against a recorded fake HTTP transport (no network). */
class StripeGatewayTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private object $http;

    protected function setUp(): void
    {
        parent::setUp();
        config(['payments.driver' => 'stripe', 'payments.stripe.secret' => 'sk_test_x', 'payments.stripe.publishable_key' => 'pk_test_x']);

        $this->http = new class implements ClientInterface
        {
            public array $requests = [];

            public int $status = 200;

            public function request($method, $absUrl, $headers, $params, $hasFile, $apiMode = 'v1', $maxNetworkRetries = null)
            {
                $this->requests[] = compact('method', 'absUrl', 'headers', 'params');
                $body = $this->status === 200
                    ? ['id' => 'pi_123', 'object' => 'payment_intent', 'client_secret' => 'pi_123_secret_abc', 'amount' => $params['amount'] ?? 0, 'currency' => 'eur', 'status' => 'requires_payment_method']
                    : ['error' => ['type' => 'api_error', 'message' => 'Stripe is down']];

                return [json_encode($body), $this->status, []];
            }
        };
        ApiRequestor::setHttpClient($this->http);
    }

    protected function tearDown(): void
    {
        ApiRequestor::setHttpClient(null);
        parent::tearDown();
    }

    public function test_driver_binding(): void
    {
        $this->assertInstanceOf(StripeGateway::class, app(PaymentGateway::class));
    }

    public function test_checkout_creates_payment_intent_with_order_amount_and_idempotency_key(): void
    {
        $this->actingAsBuyer();
        $this->addToCart($this->offerWithKeys(5, 1250), 2);

        $response = $this->postJson('/api/v1/checkout')->assertCreated()
            ->assertJsonPath('payment.provider', 'stripe')
            ->assertJsonPath('payment.client_secret', 'pi_123_secret_abc')
            ->assertJsonPath('payment.publishable_key', 'pk_test_x');

        $order = Order::findOrFail($response->json('data.id'));
        $this->assertSame('pi_123', $order->payment_ref);
        $this->assertSame('stripe', $order->payment_provider);

        $request = $this->http->requests[0];
        $this->assertStringEndsWith('/v1/payment_intents', $request['absUrl']);
        $this->assertSame(2500, $request['params']['amount']);
        $this->assertSame('eur', $request['params']['currency']);
        $this->assertSame($order->id, $request['params']['metadata']['order_id']);
        $this->assertContains("Idempotency-Key: order-{$order->id}", $request['headers']);
    }

    public function test_stripe_outage_marks_order_failed_and_returns_502(): void
    {
        $this->http->status = 500;
        $this->actingAsBuyer();
        $this->addToCart($this->offerWithKeys(5));

        $this->postJson('/api/v1/checkout')->assertStatus(502);

        $this->assertSame('payment_init_failed', Order::sole()->failure_reason);
    }

    public function test_refund_targets_the_payment_intent_idempotently(): void
    {
        $order = Order::factory()->create(['payment_provider' => 'stripe', 'payment_ref' => 'pi_123']);

        app(PaymentGateway::class)->refund($order);

        $request = $this->http->requests[0];
        $this->assertStringEndsWith('/v1/refunds', $request['absUrl']);
        $this->assertSame('pi_123', $request['params']['payment_intent']);
        $this->assertContains("Idempotency-Key: refund-{$order->id}", $request['headers']);
    }

    public function test_payment_page_reload_gets_the_same_payment_intent(): void
    {
        $this->actingAsBuyer();
        $this->addToCart($this->offerWithKeys(5, 1250));
        $orderId = $this->postJson('/api/v1/checkout')->assertCreated()->json('data.id');

        $this->getJson("/api/v1/checkout/{$orderId}/payment")->assertOk()
            ->assertJsonPath('data.id', $orderId)
            ->assertJsonPath('payment.client_secret', 'pi_123_secret_abc')
            ->assertJsonPath('payment.publishable_key', 'pk_test_x');

        // Both calls use the per-order Stripe idempotency key, so Stripe hands back one intent.
        $this->assertCount(2, $this->http->requests);
        $this->assertContains("Idempotency-Key: order-{$orderId}", $this->http->requests[1]['headers']);
        $this->assertSame(1, Order::query()->count());
    }

    public function test_no_payment_session_once_the_order_is_not_payable(): void
    {
        $this->actingAsBuyer();
        $this->addToCart($this->offerWithKeys(5));
        $orderId = $this->postJson('/api/v1/checkout')->json('data.id');
        $this->travel(16)->minutes();

        $this->getJson("/api/v1/checkout/{$orderId}/payment")->assertOk()
            ->assertJsonPath('data.status', 'expired')
            ->assertJsonPath('payment', null);
        $this->assertCount(1, $this->http->requests, 'no new intent for an expired order');
    }

    public function test_payment_session_is_private_and_requires_auth(): void
    {
        $this->actingAsBuyer();
        $this->addToCart($this->offerWithKeys(5));
        $orderId = $this->postJson('/api/v1/checkout')->json('data.id');

        $this->actingAsBuyer(); // someone else
        $this->getJson("/api/v1/checkout/{$orderId}/payment")->assertNotFound();
        $this->getJson('/api/v1/checkout/not-a-uuid/payment')->assertNotFound();

        $this->app['auth']->forgetGuards();
        $this->withHeaders(['Authorization' => ''])->getJson("/api/v1/checkout/{$orderId}/payment")->assertUnauthorized();
    }
}
