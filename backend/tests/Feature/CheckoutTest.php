<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\ProductKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['payments.driver' => 'fake']);
        $this->actingAsBuyer();
    }

    public function test_checkout_creates_pending_order_with_server_side_prices_and_snapshot(): void
    {
        $a = $this->offerWithKeys(5, 1500);
        $b = $this->offerWithKeys(5, 250);
        $this->addToCart($a, 2);
        $this->addToCart($b, 1);

        $response = $this->postJson('/api/v1/checkout', ['total_cents' => 1]) // client-sent totals are ignored
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.total_cents', 3250)
            ->assertJsonPath('payment.provider', 'fake')
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.keys', []);

        $order = Order::findOrFail($response->json('data.id'));
        $this->assertSame('fake_'.$order->id, $order->payment_ref);
        $this->assertStringEndsWith("/checkout/{$order->id}/confirm", $response->json('payment.confirm_url'));

        // Snapshot survives later listing edits.
        $a->update(['price_cents' => 9999]);
        $a->product->update(['title' => 'Renamed']);
        $item = $order->items()->where('offer_id', $a->id)->firstOrFail();
        $this->assertSame(1500, $item->unit_price_cents);
        $this->assertNotSame('Renamed', $item->product_title);

        // Keys are reserved for this order (not sold) until it's paid or expires; cart kept until then.
        $this->assertSame(3, ProductKey::where('status', 'reserved')->count());
        $this->assertSame(0, ProductKey::where('status', 'sold')->count());
        $this->assertSame(3, ProductKey::where('status', 'reserved')->whereIn('order_item_id', $order->items()->pluck('id'))->count());
        $this->assertEqualsWithDelta(now()->addMinutes(15)->timestamp, $order->expires_at->timestamp, 5);
        $response->assertJsonPath('data.expires_at', fn ($v) => $v !== null);
        $this->assertSame(2, CartItem::count());
    }

    public function test_empty_cart_cannot_check_out(): void
    {
        $this->postJson('/api/v1/checkout')->assertUnprocessable()->assertJsonValidationErrors('cart');
    }

    public function test_out_of_stock_at_checkout_is_409_and_creates_no_order(): void
    {
        $ok = $this->offerWithKeys(5);
        $scarce = $this->offerWithKeys(3);
        $this->addToCart($ok);
        $this->addToCart($scarce, 3);
        $scarce->keys()->limit(2)->get()->each->update(['status' => 'sold']); // others bought them meanwhile

        $this->postJson('/api/v1/checkout')
            ->assertStatus(409)
            ->assertJsonPath('items.0.offer_id', $scarce->id)
            ->assertJsonPath('items.0.reason', 'out_of_stock')
            ->assertJsonPath('items.0.requested', 3)
            ->assertJsonPath('items.0.available', 1)
            ->assertJsonCount(1, 'items');

        $this->assertSame(0, Order::count());
    }

    public function test_deactivated_offer_at_checkout_is_409(): void
    {
        $offer = $this->offerWithKeys(5);
        $this->addToCart($offer);
        $offer->update(['is_active' => false]);

        $this->postJson('/api/v1/checkout')->assertStatus(409)->assertJsonPath('items.0.reason', 'unavailable');
        $this->assertSame(0, Order::count());
    }

    public function test_idempotency_key_replay_returns_the_same_order(): void
    {
        $this->addToCart($this->offerWithKeys(5));

        $first = $this->withHeader('Idempotency-Key', 'abc-123')->postJson('/api/v1/checkout')->assertCreated();
        $second = $this->withHeader('Idempotency-Key', 'abc-123')->postJson('/api/v1/checkout')->assertOk();

        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertSame($first->json('payment'), $second->json('payment'));
        $this->assertSame(1, Order::count());

        $this->withHeader('Idempotency-Key', 'other-key')->postJson('/api/v1/checkout')->assertCreated();
        $this->assertSame(2, Order::count());
    }

    public function test_successful_payment_assigns_keys_and_clears_purchased_cart_lines(): void
    {
        $offer = $this->offerWithKeys(5);
        $other = $this->offerWithKeys(5);
        $order = $this->checkoutOffer($offer, 2);
        $this->addToCart($other); // added after checkout: must survive fulfillment

        $this->confirmFake($order)->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonCount(2, 'data.items.0.keys');

        $order->refresh();
        $this->assertSame(OrderStatus::Completed, $order->status);
        $this->assertNotNull($order->paid_at);
        $this->assertSame(2, ProductKey::where('status', 'sold')->where('order_item_id', $order->items->first()->id)->count());
        $this->assertSame([$other->id], CartItem::pluck('offer_id')->all());
    }

    public function test_declined_payment_assigns_no_keys(): void
    {
        $order = $this->checkoutOffer($this->offerWithKeys(5));

        $this->confirmFake($order, 'fail')->assertOk()
            ->assertJsonPath('data.status', 'failed')
            ->assertJsonPath('data.failure_reason', 'card_declined');

        $this->assertSame(0, ProductKey::where('status', 'sold')->count());
        $this->assertSame(0, ProductKey::where('status', 'reserved')->count(), 'declined: keys back on sale at once');
        $this->assertSame(1, CartItem::count(), 'cart kept so the buyer can retry');
    }

    public function test_confirming_twice_does_not_assign_more_keys(): void
    {
        $order = $this->checkoutOffer($this->offerWithKeys(5), 2);

        $this->confirmFake($order)->assertOk();
        $this->confirmFake($order)->assertOk()->assertJsonPath('data.status', 'completed');
        $this->confirmFake($order, 'fail')->assertOk()->assertJsonPath('data.status', 'completed'); // terminal

        $this->assertSame(2, ProductKey::where('status', 'sold')->count());
    }

    public function test_selling_the_last_key_deactivates_offer_and_updates_product_price(): void
    {
        $cheap = $this->offerWithKeys(1, 500);
        $pricier = $this->offerWithKeys(5, 900, ['product_id' => $cheap->product_id]);
        $this->assertSame(500, $cheap->product->fresh()->min_price_cents);

        $this->confirmFake($this->checkoutOffer($cheap))->assertOk();

        $this->assertFalse($cheap->fresh()->is_active);
        $this->assertTrue($pricier->fresh()->is_active);
        $product = $cheap->product->fresh();
        $this->assertSame(900, $product->min_price_cents);
        $this->assertSame(1, $product->offers_count);
    }

    public function test_fake_confirm_is_unavailable_with_stripe_driver(): void
    {
        $order = $this->checkoutOffer($this->offerWithKeys(5));
        config(['payments.driver' => 'stripe']);

        $this->confirmFake($order)->assertNotFound();
        $this->assertTrue($order->fresh()->isPending());
    }
}
