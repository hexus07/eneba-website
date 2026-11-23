<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\ProductKey;
use App\Models\User;
use App\Services\Checkout\OrderFulfiller;
use App\Services\Payments\PaymentGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

/**
 * Single-connection scenarios. True concurrency (separate connections / processes) is in
 * KeyAssignmentConcurrencyTest, which needs committed data and so can't use RefreshDatabase.
 */
class KeyAssignmentTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['payments.driver' => 'fake']);
    }

    /** Two buyers check out the last key (stock check passes for both), then both pay. */
    public function test_last_key_goes_to_exactly_one_order_and_the_other_is_refunded(): void
    {
        $offer = $this->offerWithKeys(1);
        $this->actingAsBuyer();
        $first = $this->checkoutOffer($offer);
        $this->actingAsBuyer(User::factory()->create());
        $second = $this->checkoutOffer($offer);

        $this->actingAsBuyer($first->user);
        $this->confirmFake($first)->assertJsonPath('data.status', 'completed')->assertJsonCount(1, 'data.items.0.keys');
        $this->actingAsBuyer($second->user);
        $this->confirmFake($second)->assertJsonPath('data.status', 'refunded')
            ->assertJsonPath('data.failure_reason', 'out_of_stock')
            ->assertJsonPath('data.items.0.keys', []);

        $key = ProductKey::sole();
        $this->assertSame($first->items()->sole()->id, $key->order_item_id);
        $this->assertSame(0, ProductKey::query()->whereHas('orderItem', fn ($q) => $q->where('order_id', $second->id))->count());
    }

    public function test_multi_item_order_is_all_or_nothing(): void
    {
        $plenty = $this->offerWithKeys(5);
        $scarce = $this->offerWithKeys(2);
        $buyer = $this->actingAsBuyer();
        $this->addToCart($plenty, 2);
        $this->addToCart($scarce, 2);
        $order = Order::findOrFail($this->postJson('/api/v1/checkout')->assertCreated()->json('data.id'));

        $scarce->keys()->first()->update(['status' => 'sold']); // sold elsewhere between checkout and payment

        $this->actingAsBuyer($buyer);
        $this->confirmFake($order)->assertJsonPath('data.status', 'refunded');

        // The 2 keys of `plenty` that were assignable must have been rolled back too.
        $this->assertSame(5, $plenty->availableKeys()->count());
        $this->assertSame(1, $scarce->availableKeys()->count());
    }

    public function test_keys_are_never_double_assigned_across_many_orders(): void
    {
        $offer = $this->offerWithKeys(7);
        $orders = collect(range(1, 5))->map(function () use ($offer) {
            $this->actingAsBuyer(User::factory()->create());

            return $this->checkoutOffer($offer, 2); // 5 × 2 = 10 wanted, 7 available
        });

        $statuses = $orders->map(fn (Order $o) => app(OrderFulfiller::class)->markPaid($o)->status);

        $this->assertSame(3, $statuses->filter(fn ($s) => $s === OrderStatus::Completed)->count());
        $this->assertSame(2, $statuses->filter(fn ($s) => $s === OrderStatus::Refunded)->count());
        $this->assertSame(6, ProductKey::where('status', 'sold')->count());
        $this->assertSame(1, ProductKey::where('status', 'available')->count());
        $this->assertSame(
            ProductKey::where('status', 'sold')->count(),
            ProductKey::where('status', 'sold')->distinct()->count('order_item_id') * 2,
            'each completed order item holds exactly its 2 keys',
        );
    }

    public function test_failed_refund_keeps_order_claimed_and_a_retry_completes_it(): void
    {
        $offer = $this->offerWithKeys(0);
        $this->actingAsBuyer();
        $order = Order::factory()->for(User::first())->create(['payment_ref' => 'pi_x']);
        $order->items()->create([
            'offer_id' => $offer->id, 'product_id' => $offer->product_id, 'product_title' => 'X', 'platform_name' => 'P',
            'region_name' => 'R', 'seller_name' => 'S', 'unit_price_cents' => 100, 'quantity' => 1,
        ]);

        $gateway = Mockery::mock(PaymentGateway::class);
        $gateway->shouldReceive('refund')->once()->andThrow(new \RuntimeException('Stripe down'));
        $gateway->shouldReceive('refund')->once()->andReturnNull();
        $this->app->instance(PaymentGateway::class, $gateway);

        try {
            app(OrderFulfiller::class)->markPaid($order);
            $this->fail('expected refund failure to propagate');
        } catch (\RuntimeException) {
        }
        // Claimed: a later stock top-up can't make a retry fulfill an order we're refunding.
        $this->assertSame(OrderStatus::Refunding, $order->fresh()->status);
        ProductKey::factory()->create(['offer_id' => $offer->id]);

        $this->assertSame(OrderStatus::Refunded, app(OrderFulfiller::class)->markPaid($order)->status);
        $this->assertSame(1, ProductKey::where('status', 'available')->count());
    }

    public function test_status_guard_prevents_overwriting_a_key_that_is_no_longer_available(): void
    {
        // Simulates the "impossible" case directly at the SQL level the fulfiller relies on:
        // the UPDATE only touches rows that are still available.
        $offer = $this->offerWithKeys(1);
        $key = $offer->keys()->sole();
        DB::table('product_keys')->where('id', $key->id)->update(['status' => 'sold']);

        $updated = ProductKey::whereIn('id', [$key->id])->where('status', 'available')->update(['status' => 'sold', 'order_item_id' => null]);

        $this->assertSame(0, $updated);
    }
}
