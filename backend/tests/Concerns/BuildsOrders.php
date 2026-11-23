<?php

namespace Tests\Concerns;

use App\Models\Offer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductKey;
use App\Models\User;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

trait BuildsOrders
{
    protected function offerWithKeys(int $keys, int $priceCents = 1999, array $attrs = []): Offer
    {
        $offer = Offer::factory()->create(array_merge([
            'product_id' => Product::factory()->withoutOffers(),
            'price_cents' => $priceCents,
        ], $attrs));

        ProductKey::factory()->count($keys)->create(['offer_id' => $offer->id]);

        return $offer;
    }

    protected function actingAsBuyer(?User $user = null): User
    {
        $user ??= User::factory()->create();
        Sanctum::actingAs($user);

        return $user;
    }

    protected function addToCart(Offer $offer, int $quantity = 1): void
    {
        $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id, 'quantity' => $quantity])->assertCreated();
    }

    /** Cart → checkout as the current buyer; returns the pending order. */
    protected function checkoutOffer(Offer $offer, int $quantity = 1): Order
    {
        $this->addToCart($offer, $quantity);
        $id = $this->postJson('/api/v1/checkout')->assertCreated()->json('data.id');

        return Order::findOrFail($id);
    }

    protected function confirmFake(Order $order, string $outcome = 'succeed'): TestResponse
    {
        return $this->postJson("/api/v1/checkout/{$order->id}/confirm", ['outcome' => $outcome]);
    }
}
