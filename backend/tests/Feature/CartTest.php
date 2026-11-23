<?php

namespace Tests\Feature;

use App\Models\CartItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

class CartTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAsBuyer();
    }

    public function test_add_item_and_view_cart_with_live_prices_and_totals(): void
    {
        $a = $this->offerWithKeys(5, 1500);
        $b = $this->offerWithKeys(5, 999);

        $this->addToCart($a, 2);
        $this->addToCart($b);

        $this->getJson('/api/v1/cart')->assertOk()
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.offer_id', $a->id)
            ->assertJsonPath('data.items.0.line_total_cents', 3000)
            ->assertJsonPath('data.items.0.available_stock', 5)
            ->assertJsonPath('data.totals.items_count', 3)
            ->assertJsonPath('data.totals.subtotal_cents', 3999)
            ->assertJsonPath('data.totals.is_purchasable', true);

        $a->update(['price_cents' => 1000]); // prices are live, not frozen in the cart
        $this->getJson('/api/v1/cart')->assertJsonPath('data.totals.subtotal_cents', 2999);
    }

    public function test_adding_same_offer_twice_increments_quantity(): void
    {
        $offer = $this->offerWithKeys(5);

        $this->addToCart($offer);
        $this->addToCart($offer, 2);

        $this->assertSame(1, CartItem::count());
        $this->assertSame(3, CartItem::firstOrFail()->quantity);
    }

    public function test_update_and_remove_item(): void
    {
        $offer = $this->offerWithKeys(5);
        $this->addToCart($offer);
        $id = CartItem::firstOrFail()->id;

        $this->patchJson("/api/v1/cart/items/$id", ['quantity' => 4])->assertOk()->assertJsonPath('data.items.0.quantity', 4);
        $this->deleteJson("/api/v1/cart/items/$id")->assertOk()->assertJsonCount(0, 'data.items');
    }

    public function test_cannot_add_more_than_stock(): void
    {
        $offer = $this->offerWithKeys(2);

        $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id, 'quantity' => 3])
            ->assertUnprocessable()->assertJsonPath('errors.quantity.0', 'Only 2 left in stock.');

        $this->addToCart($offer, 2);
        $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id])->assertUnprocessable();
        $this->assertSame(2, CartItem::firstOrFail()->quantity);
    }

    public function test_cannot_add_sold_out_or_inactive_offer(): void
    {
        $soldOut = $this->offerWithKeys(0);
        $inactive = $this->offerWithKeys(5, attrs: ['is_active' => false]);

        $this->postJson('/api/v1/cart/items', ['offer_id' => $soldOut->id])
            ->assertUnprocessable()->assertJsonPath('errors.quantity.0', 'This offer is out of stock.');
        $this->postJson('/api/v1/cart/items', ['offer_id' => $inactive->id])->assertJsonValidationErrors('offer_id');
        $this->postJson('/api/v1/cart/items', ['offer_id' => 999999])->assertJsonValidationErrors('offer_id');
        $this->assertSame(0, CartItem::count());
    }

    public function test_quantity_limits(): void
    {
        $offer = $this->offerWithKeys(20);

        $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id, 'quantity' => 0])->assertJsonValidationErrors('quantity');
        $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id, 'quantity' => 11])->assertJsonValidationErrors('quantity');
        $this->addToCart($offer, 10);
        $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id])->assertJsonValidationErrors('quantity');
    }

    public function test_cart_flags_items_that_went_out_of_stock_after_adding(): void
    {
        $offer = $this->offerWithKeys(3);
        $this->addToCart($offer, 3);

        $offer->keys()->limit(2)->get()->each->update(['status' => 'sold']);

        $this->getJson('/api/v1/cart')
            ->assertJsonPath('data.items.0.available_stock', 1)
            ->assertJsonPath('data.items.0.is_purchasable', false)
            ->assertJsonPath('data.totals.is_purchasable', false);
    }

    public function test_merge_guest_cart_clamps_and_drops_unavailable_lines(): void
    {
        $existing = $this->offerWithKeys(10);
        $scarce = $this->offerWithKeys(2);
        $inactive = $this->offerWithKeys(5, attrs: ['is_active' => false]);
        $this->addToCart($existing, 1);

        $this->postJson('/api/v1/cart/merge', ['items' => [
            ['offer_id' => $existing->id, 'quantity' => 2],
            ['offer_id' => $scarce->id, 'quantity' => 5],
            ['offer_id' => $inactive->id, 'quantity' => 1],
            ['offer_id' => 999999, 'quantity' => 1],
        ]])->assertOk()->assertJsonCount(2, 'data.items');

        $quantities = CartItem::query()->pluck('quantity', 'offer_id');
        $this->assertSame(3, $quantities[$existing->id]);
        $this->assertSame(2, $quantities[$scarce->id]);
    }
}
