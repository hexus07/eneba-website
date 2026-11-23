<?php

namespace App\Services\Home\Blocks;

use App\Http\Resources\ProductCardResource;
use App\Models\HomeBlock;
use App\Models\Product;
use App\Services\Home\BlockProvider;

/** Source: `products.release_date` — most recently released games that are in stock. */
class NewReleasesBlockProvider implements BlockProvider
{
    public function provide(HomeBlock $block): array
    {
        $products = Product::query()->with(['platform', 'region'])
            ->where('offers_count', '>', 0)
            ->whereIn('type', $block->setting('types', ['game']))
            ->whereNotNull('release_date')
            ->where('release_date', '<=', today())
            ->orderByDesc('release_date')->orderByDesc('sales_count')->orderBy('id')
            ->limit((int) $block->setting('limit', 12))
            ->get();

        return [
            'items' => ProductCardResource::collection($products)->resolve(),
            'see_all_url' => '/store?sort=newest',
        ];
    }
}
