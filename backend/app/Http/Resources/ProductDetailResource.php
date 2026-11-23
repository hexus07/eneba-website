<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product  (requires `offers` (purchasable, cheapest first) and `variants` set by the controller) */
class ProductDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            ...(new ProductCardResource($this->resource))->toArray($request),
            'description' => $this->description,
            'developer' => $this->developer,
            'publisher' => $this->publisher,
            'genres' => $this->genres->map(fn ($g) => ['slug' => $g->slug, 'name' => $g->name])->all(),
            'offers' => OfferResource::collection($this->offers)->resolve($request),
            // Same title on other platforms / regions (Eneba's "Other versions" switcher).
            'variants' => $this->variants->map(fn (Product $v) => [
                'slug' => $v->slug,
                'platform' => ['slug' => $v->platform->slug, 'name' => $v->platform->name],
                'region' => ['slug' => $v->region->slug, 'name' => $v->region->name],
                'min_price_cents' => $v->min_price_cents,
                'offers_count' => $v->offers_count,
            ])->all(),
        ];
    }
}
