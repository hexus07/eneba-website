<?php

namespace App\Services\Home\Blocks;

use App\Http\Resources\ProductCardResource;
use App\Models\HomeBlock;
use App\Models\Product;
use App\Services\Home\BlockProvider;
use App\Services\Home\OnePerTitle;

/**
 * Source: `products` of one platform (block config `platform`: a slug), in stock, most popular
 * first. One row per configured block, e.g. "Top on Steam", "PlayStation picks".
 */
class ByPlatformBlockProvider implements BlockProvider
{
    public function provide(HomeBlock $block): array
    {
        $platform = (string) $block->setting('platform', '');

        $products = $platform === '' ? collect() : Product::query()->with(['platform', 'region'])
            ->whereHas('platform', fn ($q) => $q->where('slug', $platform))
            ->where('offers_count', '>', 0)
            ->orderByDesc('sales_count')->orderBy('id')
            ->limit((int) $block->setting('limit', 12) * OnePerTitle::OVERFETCH)
            ->get();
        $products = OnePerTitle::take($products, (int) $block->setting('limit', 12), fn (Product $p) => $p->title);

        return [
            'items' => ProductCardResource::collection($products)->resolve(),
            'see_all_url' => $platform === '' ? null : '/store?platform='.rawurlencode($platform),
        ];
    }
}
