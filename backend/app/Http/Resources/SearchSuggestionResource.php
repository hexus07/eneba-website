<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Header autocomplete row, one per TITLE: the cheapest in-stock variant (slug, cover, platform) with
 * the title's lowest price and how many platform/region variants are in stock. Only what the
 * dropdown shows (it fires on every debounced keystroke). Full cards come from GET /products.
 *
 * @mixin Product
 */
class SearchSuggestionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'title' => $this->title,
            'cover_url' => $this->cover_url,
            'min_price_cents' => $this->min_price_cents,
            'currency' => 'EUR',
            'platform' => ['slug' => $this->platform->slug, 'name' => $this->platform->name],
            'variants_count' => (int) $this->variants_count,
        ];
    }
}
