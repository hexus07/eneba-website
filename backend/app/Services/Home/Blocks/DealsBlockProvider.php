<?php

namespace App\Services\Home\Blocks;

use App\Http\Resources\ProductCardResource;
use App\Models\HomeBlock;
use App\Models\Offer;
use App\Services\Home\BlockProvider;
use App\Services\Home\OnePerTitle;

/**
 * Source: `offers` — active listings with the largest discount vs their "was" price.
 * One entry per product (its best-discount offer), so a block isn't five copies of one game.
 */
class DealsBlockProvider implements BlockProvider
{
    public function provide(HomeBlock $block): array
    {
        $limit = (int) $block->setting('limit', 12);
        $minDiscount = (int) $block->setting('min_discount_percent', 20);

        $best = Offer::query()
            ->selectRaw('DISTINCT ON (offers.product_id) offers.*, ROUND(100.0 * (original_price_cents - price_cents) / original_price_cents) AS discount_percent')
            ->where('is_active', true)
            ->whereNotNull('original_price_cents')
            ->whereColumn('original_price_cents', '>', 'price_cents')
            ->orderBy('offers.product_id')
            ->orderByRaw('(original_price_cents - price_cents)::numeric / original_price_cents DESC')
            ->orderBy('offers.id');

        $offers = Offer::query()->fromSub($best, 'offers')
            ->where('discount_percent', '>=', $minDiscount)
            ->orderByDesc('discount_percent')->orderBy('price_cents')->orderBy('id')
            ->limit($limit * OnePerTitle::OVERFETCH)
            ->with(['product.platform', 'product.region', 'seller'])
            ->get();
        $offers = OnePerTitle::take($offers, $limit, fn (Offer $o) => $o->product->title);

        return ['items' => $offers->map(fn (Offer $o) => [
            ...(new ProductCardResource($o->product))->resolve(),
            'deal' => [
                'offer_id' => $o->id,
                'price_cents' => $o->price_cents,
                'original_price_cents' => $o->original_price_cents,
                'discount_percent' => (int) $o->discount_percent,
                'seller_name' => $o->seller->name,
            ],
        ])->all(), 'see_all_url' => '/store?sort=price_asc'];
    }
}
