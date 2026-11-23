<?php

namespace App\Services\Home\Blocks;

use App\Http\Resources\ProductCardResource;
use App\Models\HomeBlock;
use App\Models\Product;
use App\Services\Home\BlockProvider;
use App\Services\Home\OnePerTitle;
use Illuminate\Support\Facades\DB;

/**
 * Source: completed orders (`order_items` units sold in the last N days). When there aren't enough
 * recent sales to fill the block (new store, quiet week), it tops up with all-time `sales_count`,
 * so the block is never empty but real sales always rank first.
 */
class BestSellersBlockProvider implements BlockProvider
{
    public function provide(HomeBlock $block): array
    {
        $limit = (int) $block->setting('limit', 12);
        $days = (int) $block->setting('days', 30);
        $fetch = $limit * OnePerTitle::OVERFETCH;

        $recent = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', 'completed')
            ->where('orders.paid_at', '>=', now()->subDays($days))
            ->groupBy('order_items.product_id')
            ->orderByRaw('SUM(order_items.quantity) DESC')
            ->orderBy('order_items.product_id')
            ->limit($fetch)
            ->pluck('order_items.product_id');

        $products = Product::query()->with(['platform', 'region'])
            ->whereIn('id', $recent)->where('offers_count', '>', 0)->get()
            ->sortBy(fn (Product $p) => $recent->search($p->id))->values();

        if ($products->count() < $fetch) {
            $products = $products->concat(
                Product::query()->with(['platform', 'region'])
                    ->where('offers_count', '>', 0)
                    ->whereNotIn('id', $products->pluck('id'))
                    ->orderByDesc('sales_count')->orderBy('id')
                    ->limit($fetch - $products->count())
                    ->get()
            );
        }

        return [
            'items' => ProductCardResource::collection(OnePerTitle::take($products, $limit, fn (Product $p) => $p->title))->resolve(),
            'see_all_url' => '/store?sort=popular',
        ];
    }
}
