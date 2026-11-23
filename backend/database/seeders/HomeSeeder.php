<?php

namespace Database\Seeders;

use App\Models\Banner;
use App\Models\HomeBlock;
use App\Models\Product;
use Illuminate\Database\Seeder;

/** Homepage layout + hero banners. Idempotent (upserts by block key / banner title). Run after CatalogSeeder. */
class HomeSeeder extends Seeder
{
    public const BLOCKS = [
        ['key' => 'hero', 'type' => 'hero_banner', 'title' => 'Featured', 'config' => ['limit' => 5]],
        ['key' => 'best-sellers', 'type' => 'best_sellers', 'title' => 'Best sellers', 'config' => ['limit' => 12, 'days' => 30]],
        ['key' => 'top-deals', 'type' => 'deals', 'title' => 'Top deals', 'config' => ['limit' => 12, 'min_discount_percent' => 30]],
        ['key' => 'top-steam', 'type' => 'by_platform', 'title' => 'Top on Steam', 'config' => ['platform' => 'steam', 'limit' => 12]],
        ['key' => 'new-releases', 'type' => 'new_releases', 'title' => 'New releases', 'config' => ['limit' => 12]],
        ['key' => 'playstation', 'type' => 'by_platform', 'title' => 'PlayStation picks', 'config' => ['platform' => 'psn', 'limit' => 12]],
        ['key' => 'platforms', 'type' => 'platform_tiles', 'title' => 'Shop by platform', 'config' => []],
    ];

    /** [title of the game to feature, headline, subline] */
    private const BANNERS = [
        ['Elden Ring: Shadow of the Erdtree', 'Shadow of the Erdtree', 'The expansion is here: grab the key for less'],
        ["Baldur's Gate 3", "Baldur's Gate 3", 'Game of the Year, from every seller in one place'],
        ['Helldivers 2', 'Helldivers 2', 'Spread managed democracy at a discount'],
    ];

    public function run(): void
    {
        foreach (self::BLOCKS as $position => $block) {
            HomeBlock::query()->updateOrCreate(['key' => $block['key']], [...$block, 'position' => ($position + 1) * 10, 'is_active' => true]);
        }

        foreach (self::BANNERS as $position => [$title, $headline, $subline]) {
            // Feature the most popular in-stock variant of that title.
            $product = Product::query()->where('title', $title)->where('offers_count', '>', 0)
                ->whereNotNull('cover_url')->orderByDesc('sales_count')->first();
            if (! $product) {
                continue;
            }

            Banner::query()->updateOrCreate(['title' => $headline], [
                'subtitle' => $subline,
                // Banners are wide: use Steam's landscape header, not the portrait card cover.
                'image_url' => str_replace('/library_600x900.jpg', '/header.jpg', $product->cover_url),
                'cta_label' => 'Buy now',
                'cta_url' => "/product/{$product->slug}",
                'position' => $position,
                'is_active' => true,
            ]);
        }
    }
}
