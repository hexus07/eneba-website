<?php

use App\Services\Home\Blocks;

return [
    // home_blocks.type => provider. Adding a block type = one provider class + one line here.
    'providers' => [
        'hero_banner' => Blocks\HeroBannerBlockProvider::class,
        'best_sellers' => Blocks\BestSellersBlockProvider::class,
        'deals' => Blocks\DealsBlockProvider::class,
        'new_releases' => Blocks\NewReleasesBlockProvider::class,
        'by_platform' => Blocks\ByPlatformBlockProvider::class,
        'platform_tiles' => Blocks\PlatformTilesBlockProvider::class,
    ],
];
