<?php

namespace App\Http\Resources;

use App\Models\Offer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Offer  (requires `available_stock` set by the caller) */
class OfferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $discount = $this->original_price_cents && $this->original_price_cents > $this->price_cents
            ? (int) round(100 * ($this->original_price_cents - $this->price_cents) / $this->original_price_cents)
            : null;

        return [
            'id' => $this->id,
            'price_cents' => $this->price_cents,
            'original_price_cents' => $this->original_price_cents,
            'discount_percent' => $discount,
            'currency' => $this->currency,
            'available_stock' => $this->available_stock,
            'seller' => [
                'slug' => $this->seller->slug,
                'name' => $this->seller->name,
                'rating' => (float) $this->seller->rating,
                'reviews_count' => $this->seller->reviews_count,
                'is_verified' => $this->seller->is_verified,
            ],
        ];
    }
}
