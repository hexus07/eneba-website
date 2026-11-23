<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

class CartPreviewTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    public function test_prices_a_guest_cart_live_without_auth_or_storage(): void
    {
        $a = $this->offerWithKeys(5, 1500);
        $b = $this->offerWithKeys(2, 999);

        $this->postJson('/api/v1/cart/preview', ['items' => [
            ['offer_id' => $b->id, 'quantity' => 1],
            ['offer_id' => $a->id, 'quantity' => 2],
        ]])->assertOk()
            ->assertJsonPath('data.items.0.offer_id', $b->id, 'input order kept')
            ->assertJsonPath('data.items.0.id', null)
            ->assertJsonPath('data.items.1.line_total_cents', 3000)
            ->assertJsonPath('data.items.1.available_stock', 5)
            ->assertJsonPath('data.items.1.product.title', $a->product->title)
            ->assertJsonPath('data.totals.items_count', 3)
            ->assertJsonPath('data.totals.subtotal_cents', 3999)
            ->assertJsonPath('data.totals.is_purchasable', true);

        $this->assertDatabaseCount('cart_items', 0);
    }

    public function test_uses_current_prices_not_what_the_guest_saw_earlier(): void
    {
        $offer = $this->offerWithKeys(5, 1500);
        $offer->update(['price_cents' => 1200]);

        $this->postJson('/api/v1/cart/preview', ['items' => [['offer_id' => $offer->id, 'quantity' => 1]]])
            ->assertJsonPath('data.items.0.unit_price_cents', 1200);
    }

    public function test_flags_unavailable_lines_and_drops_unknown_offers(): void
    {
        $scarce = $this->offerWithKeys(1);
        $inactive = $this->offerWithKeys(5, attrs: ['is_active' => false]);

        $this->postJson('/api/v1/cart/preview', ['items' => [
            ['offer_id' => $scarce->id, 'quantity' => 3],
            ['offer_id' => $inactive->id, 'quantity' => 1],
            ['offer_id' => 999999, 'quantity' => 1],
        ]])->assertOk()
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.is_purchasable', false)
            ->assertJsonPath('data.items.0.available_stock', 1)
            ->assertJsonPath('data.items.1.available_stock', 0)
            ->assertJsonPath('data.totals.is_purchasable', false);
    }

    public function test_combines_repeated_offers(): void
    {
        $offer = $this->offerWithKeys(5);

        $this->postJson('/api/v1/cart/preview', ['items' => [['offer_id' => $offer->id, 'quantity' => 1], ['offer_id' => $offer->id, 'quantity' => 2]]])
            ->assertJsonCount(1, 'data.items')->assertJsonPath('data.items.0.quantity', 3);
    }

    public function test_validation_and_empty_cart(): void
    {
        $this->postJson('/api/v1/cart/preview', [])->assertUnprocessable()->assertJsonValidationErrors('items');
        $this->postJson('/api/v1/cart/preview', ['items' => [['offer_id' => 1, 'quantity' => 0]]])->assertJsonValidationErrors('items.0.quantity');
        $this->postJson('/api/v1/cart/preview', ['items' => []])->assertOk()
            ->assertJsonPath('data.items', [])->assertJsonPath('data.totals.is_purchasable', false);
    }

    public function test_is_rate_limited(): void
    {
        foreach (range(1, 60) as $_) {
            $this->postJson('/api/v1/cart/preview', ['items' => []])->assertOk();
        }
        $this->postJson('/api/v1/cart/preview', ['items' => []])->assertTooManyRequests();
    }

    public function test_me_alias_matches_auth_me(): void
    {
        $this->getJson('/api/v1/me')->assertUnauthorized();

        $user = $this->actingAsBuyer(User::factory()->create(['name' => 'Ada']));
        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.id', $user->id)->assertJsonPath('data.name', 'Ada');
        $this->assertSame($this->getJson('/api/v1/auth/me')->json(), $this->getJson('/api/v1/me')->json());
    }
}
