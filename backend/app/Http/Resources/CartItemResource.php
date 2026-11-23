<?php

namespace App\Http\Resources;

use App\Models\CartItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CartItem  (requires `available_stock` set by CartService) */
class CartItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $offer = $this->offer;
        $product = $offer->product;

        return [
            'id' => $this->id,
            'offer_id' => $this->offer_id,
            'quantity' => $this->quantity,
            'unit_price_cents' => $offer->price_cents,
            'line_total_cents' => $offer->price_cents * $this->quantity,
            'currency' => $offer->currency,
            'available_stock' => $this->available_stock,
            'is_purchasable' => $offer->is_active && $this->quantity <= $this->available_stock,
            'product' => [
                'slug' => $product->slug,
                'title' => $product->title,
                'cover_url' => $product->cover_url,
                'platform' => ['slug' => $product->platform->slug, 'name' => $product->platform->name],
                'region' => ['slug' => $product->region->slug, 'name' => $product->region->name],
            ],
            'seller' => ['slug' => $offer->seller->slug, 'name' => $offer->seller->name, 'rating' => (float) $offer->seller->rating],
        ];
    }
}
