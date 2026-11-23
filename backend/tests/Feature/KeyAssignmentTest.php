<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\CartItem;
use App\Models\Offer;
use App\Models\Order;
use App\Models\ProductKey;
use App\Models\User;
use App\Services\Checkout\OrderFulfiller;
use App\Services\Payments\PaymentGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Mockery;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

/**
 * Reservation semantics on one connection. True concurrency (separate connections / processes) is
 * in KeyAssignmentConcurrencyTest.
 */
class KeyAssignmentTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['payments.driver' => 'fake']);
    }

    /** A buyer whose cart holds `$quantity` of `$offer`; returns the checkout response. */
    private function checkoutAs(Offer $offer, int $quantity = 1): TestResponse
    {
        $buyer = $this->actingAsBuyer(User::factory()->create());
        // Directly, as if added while stock lasted (adding now would be refused by the cart's own check).
        CartItem::create(['user_id' => $buyer->id, 'offer_id' => $offer->id, 'quantity' => $quantity]);

        return $this->postJson('/api/v1/checkout');
    }

    public function test_the_last_key_is_reserved_for_the_first_buyer_and_the_second_is_told_it_is_gone(): void
    {
        $offer = $this->offerWithKeys(1);

        $first = $this->checkoutAs($offer)->assertCreated();
        $this->checkoutAs($offer)->assertStatus(409)
            ->assertJsonPath('items.0.offer_id', $offer->id)
            ->assertJsonPath('items.0.available', 0);

        $this->assertSame(1, Order::count(), 'no order for the second buyer');
        $key = ProductKey::sole();
        $this->assertSame('reserved', $key->status->value);
        $this->assertSame(Order::findOrFail($first->json('data.id'))->items()->sole()->id, $key->order_item_id);
    }

    public function test_checkout_is_all_or_nothing_across_items(): void
    {
        $plenty = $this->offerWithKeys(5);
        $scarce = $this->offerWithKeys(2);
        $this->actingAsBuyer();
        $this->addToCart($plenty, 2);
        $this->addToCart($scarce, 2);
        // Someone else takes one scarce key between "add to cart" and checkout.
        $scarce->keys()->first()->update(['status' => 'sold']);

        $this->postJson('/api/v1/checkout')->assertStatus(409)->assertJsonPath('items.0.offer_id', $scarce->id);

        $this->assertSame(0, Order::count());
        $this->assertSame(5, $plenty->availableKeys()->count(), 'nothing of the first item stays reserved');
    }

    public function test_paying_sells_exactly_the_reserved_keys(): void
    {
        $offer = $this->offerWithKeys(5);
        $order = Order::findOrFail($this->checkoutAs($offer, 2)->json('data.id'));
        $reserved = ProductKey::where('status', 'reserved')->orderBy('id')->pluck('id')->all();

        $this->actingAsBuyer($order->user);
        $this->confirmFake($order)->assertOk()->assertJsonPath('data.status', 'completed');

        $this->assertSame($reserved, ProductKey::where('status', 'sold')->orderBy('id')->pluck('id')->all());
        $this->assertSame(3, $offer->availableKeys()->count());
    }

    public function test_keys_are_never_double_reserved_or_sold_across_many_buyers(): void
    {
        $offer = $this->offerWithKeys(7);
        $responses = collect(range(1, 5))->map(fn () => $this->checkoutAs($offer, 2)); // 10 wanted, 7 keys

        $this->assertSame([201, 201, 201, 409, 409], $responses->map->status()->all());
        $this->assertSame(6, ProductKey::where('status', 'reserved')->distinct()->count('id'));
        $this->assertSame(3, ProductKey::where('status', 'reserved')->distinct()->count('order_item_id'));

        Order::all()->each(fn (Order $o) => app(OrderFulfiller::class)->markPaid($o));
        $this->assertSame(6, ProductKey::where('status', 'sold')->count());
        $this->assertSame(1, ProductKey::where('status', 'available')->count());
    }

    public function test_a_late_payment_whose_refund_fails_stays_claimed_and_a_retry_completes_it(): void
    {
        $offer = $this->offerWithKeys(1);
        $order = Order::findOrFail($this->checkoutAs($offer)->json('data.id'));
        $this->travel(16)->minutes(); // reservation lapsed

        $gateway = Mockery::mock(PaymentGateway::class);
        $gateway->shouldReceive('refund')->once()->andThrow(new \RuntimeException('Stripe down'));
        $gateway->shouldReceive('refund')->once()->andReturnNull();
        $this->app->instance(PaymentGateway::class, $gateway);

        try {
            app(OrderFulfiller::class)->markPaid($order);
            $this->fail('expected the refund failure to propagate');
        } catch (\RuntimeException) {
        }
        $this->assertSame(OrderStatus::Refunding, $order->fresh()->status);
        $this->assertSame(1, $offer->availableKeys()->count(), 'its key went back on sale');

        $this->assertSame(OrderStatus::Refunded, app(OrderFulfiller::class)->markPaid($order)->status);
    }

    public function test_status_guard_prevents_reserving_a_key_that_is_no_longer_available(): void
    {
        $offer = $this->offerWithKeys(1);
        $key = $offer->keys()->sole();
        DB::table('product_keys')->where('id', $key->id)->update(['status' => 'sold']);

        $updated = ProductKey::whereIn('id', [$key->id])->where('status', 'available')->update(['status' => 'reserved']);

        $this->assertSame(0, $updated);
    }
}
