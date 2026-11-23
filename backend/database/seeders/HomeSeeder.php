<?php

namespace Database\Seeders;

use App\Models\Banner;
use App\Models\HomeBlock;
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

    /**
     * Our own copy on token gradients (no Eneba or publisher artwork). Claims stay true for any
     * catalog: no "up to N% off" or seller counts that the data could contradict.
     */
    public const BANNERS = [
        ['title' => 'Game keys for less', 'subtitle' => 'Compare offers from many sellers and pay the lowest price.', 'theme' => 'violet', 'cta_label' => 'Browse the store', 'cta_url' => '/store'],
        ['title' => 'Big discounts on top games', 'subtitle' => 'The deepest price cuts right now, refreshed as sellers change prices.', 'theme' => 'gold', 'cta_label' => 'See the deals', 'cta_url' => '/store?sort=price_asc'],
        ['title' => 'Fresh releases', 'subtitle' => 'Recently released games, delivered as instant digital keys.', 'theme' => 'teal', 'cta_label' => "What's new", 'cta_url' => '/store?sort=newest'],
    ];

    public function run(): void
    {
        foreach (self::BLOCKS as $position => $block) {
            HomeBlock::query()->updateOrCreate(['key' => $block['key']], [...$block, 'position' => ($position + 1) * 10, 'is_active' => true]);
        }

        foreach (self::BANNERS as $position => $banner) {
            Banner::query()->updateOrCreate(['title' => $banner['title']], [...$banner, 'image_url' => null, 'position' => $position, 'is_active' => true]);
        }
    }
}
