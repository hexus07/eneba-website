<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
class ProductCardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'type' => $this->type,
            'platform' => ['slug' => $this->platform->slug, 'name' => $this->platform->name],
            'region' => ['slug' => $this->region->slug, 'name' => $this->region->name],
            'cover_url' => $this->cover_url,
            'min_price_cents' => $this->min_price_cents,
            'currency' => 'EUR',
            'offers_count' => $this->offers_count,
            'release_date' => $this->release_date?->toDateString(),
        ];
    }
}
