<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

class OrderHistoryTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['payments.driver' => 'fake']);
    }

    public function test_history_lists_own_orders_newest_first_with_keys_for_completed_orders(): void
    {
        $buyer = $this->actingAsBuyer();
        $completed = $this->checkoutOffer($this->offerWithKeys(5), 2);
        $this->confirmFake($completed)->assertOk();
        $this->travel(1)->minute();
        $pending = $this->checkoutOffer($this->offerWithKeys(5));

        $this->actingAsBuyer(User::factory()->create());
        $this->checkoutOffer($this->offerWithKeys(5)); // someone else's

        $this->actingAsBuyer($buyer);
        $response = $this->getJson('/api/v1/orders')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $pending->id)
            ->assertJsonPath('data.0.items.0.keys', [])
            ->assertJsonPath('data.1.id', $completed->id)
            ->assertJsonPath('data.1.status', 'completed')
            ->assertJsonCount(2, 'data.1.items.0.keys')
            ->assertJsonStructure(['data' => [['items' => [['product_title', 'seller_name', 'unit_price_cents', 'keys']]]], 'meta' => ['total']]);

        $codes = $response->json('data.1.items.0.keys.*.code');
        $this->assertSame($completed->items->first()->keys->pluck('code')->all(), $codes);
        foreach ($codes as $code) {
            $this->assertMatchesRegularExpression('/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/', $code);
        }
    }

    public function test_order_detail_returns_keys(): void
    {
        $this->actingAsBuyer();
        $order = $this->checkoutOffer($this->offerWithKeys(3));
        $this->confirmFake($order);

        $this->getJson("/api/v1/orders/{$order->id}")->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonCount(1, 'data.items.0.keys');
    }

    public function test_refunded_and_failed_orders_show_no_keys(): void
    {
        $this->actingAsBuyer();
        $failed = $this->checkoutOffer($this->offerWithKeys(3));
        $this->confirmFake($failed, 'fail');

        $this->getJson("/api/v1/orders/{$failed->id}")->assertJsonPath('data.status', 'failed')->assertJsonPath('data.items.0.keys', []);
    }

    public function test_key_codes_never_appear_in_cart_or_checkout_responses(): void
    {
        $this->actingAsBuyer();
        $offer = $this->offerWithKeys(1);
        $code = $offer->keys()->sole()->code;
        $this->addToCart($offer);

        $this->assertStringNotContainsString($code, $this->getJson('/api/v1/cart')->getContent());
        $this->assertStringNotContainsString($code, $this->postJson('/api/v1/checkout')->getContent());
    }
}
