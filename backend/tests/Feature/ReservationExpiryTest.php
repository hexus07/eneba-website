<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\ProductKey;
use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

class ReservationExpiryTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['payments.driver' => 'fake']);
    }

    public function test_the_command_expires_stale_orders_and_releases_their_keys_only(): void
    {
        $offer = $this->offerWithKeys(6);
        $this->actingAsBuyer();
        $stale = $this->checkoutOffer($offer, 2);
        $this->travel(10)->minutes();
        $this->actingAsBuyer(User::factory()->create());
        $fresh = $this->checkoutOffer($offer, 1);
        $this->travel(6)->minutes(); // stale: 16 min old, fresh: 6 min old

        $this->artisan('orders:expire-reservations')->expectsOutputToContain('1 order(s) expired.')->assertSuccessful();

        $this->assertSame(OrderStatus::Expired, $stale->fresh()->status);
        $this->assertSame('reservation_expired', $stale->fresh()->failure_reason);
        $this->assertSame(OrderStatus::Pending, $fresh->fresh()->status);
        $this->assertSame(1, ProductKey::where('status', 'reserved')->count(), 'only the fresh order holds a key');
        $this->assertSame(5, $offer->availableKeys()->count());
    }

    public function test_paid_and_failed_orders_are_never_expired(): void
    {
        $this->actingAsBuyer();
        $paid = $this->checkoutOffer($this->offerWithKeys(2));
        $this->confirmFake($paid)->assertOk();
        $declined = $this->checkoutOffer($this->offerWithKeys(2));
        $this->confirmFake($declined, 'fail')->assertOk();
        $this->travel(1)->hour();

        $this->artisan('orders:expire-reservations')->expectsOutputToContain('0 order(s) expired.');

        $this->assertSame(OrderStatus::Completed, $paid->fresh()->status);
        $this->assertSame(OrderStatus::Failed, $declined->fresh()->status);
        $this->assertSame(1, ProductKey::where('status', 'sold')->count());
    }

    public function test_checkout_reclaims_expired_reservations_even_without_the_scheduler(): void
    {
        $offer = $this->offerWithKeys(1);
        $this->actingAsBuyer();
        $abandoned = $this->checkoutOffer($offer);
        $this->travel(16)->minutes();

        $buyer = $this->actingAsBuyer(User::factory()->create());
        CartItem::create(['user_id' => $buyer->id, 'offer_id' => $offer->id, 'quantity' => 1]);

        $this->postJson('/api/v1/checkout')->assertCreated();
        $this->assertSame(OrderStatus::Expired, $abandoned->fresh()->status);
        $this->assertSame(1, ProductKey::where('status', 'reserved')->count());
    }

    public function test_confirming_after_expiry_is_refused_and_sells_nothing(): void
    {
        $offer = $this->offerWithKeys(2);
        $this->actingAsBuyer();
        $order = $this->checkoutOffer($offer);
        $this->travel(15 * 60 + 1)->seconds(); // one second past the reservation

        $this->confirmFake($order)->assertStatus(409)
            ->assertJsonPath('message', 'Your reservation expired. Please check out again.')
            ->assertJsonPath('data.status', 'expired');

        $this->assertSame(0, ProductKey::where('status', 'sold')->count());
        $this->assertSame(2, $offer->availableKeys()->count());
    }

    public function test_an_idempotent_replay_of_an_expired_checkout_does_not_resume_payment(): void
    {
        $this->actingAsBuyer();
        $this->addToCart($this->offerWithKeys(2));
        $this->withHeader('Idempotency-Key', 'k1')->postJson('/api/v1/checkout')->assertCreated();
        $this->travel(16)->minutes();

        $this->withHeader('Idempotency-Key', 'k1')->postJson('/api/v1/checkout')->assertOk()
            ->assertJsonPath('data.status', 'expired')
            ->assertJsonPath('payment', null);
        $this->assertSame(1, Order::count());
    }

    public function test_an_offer_is_only_deactivated_when_nothing_is_left_even_in_reservations(): void
    {
        $offer = $this->offerWithKeys(2);
        $this->actingAsBuyer();
        $first = $this->checkoutOffer($offer);
        $this->actingAsBuyer(User::factory()->create());
        $this->checkoutOffer($offer); // second key reserved, unpaid

        $this->actingAsBuyer($first->user);
        $this->confirmFake($first)->assertOk();
        $this->assertTrue($offer->fresh()->is_active, 'a reserved key may still come back');
    }

    public function test_the_expiry_command_is_scheduled_every_minute(): void
    {
        $event = collect(app(Schedule::class)->events())->first(fn ($e) => str_contains($e->command ?? '', 'orders:expire-reservations'));

        $this->assertNotNull($event);
        $this->assertSame('* * * * *', $event->expression);
    }
}
