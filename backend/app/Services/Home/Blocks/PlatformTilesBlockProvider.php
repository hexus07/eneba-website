<?php

namespace App\Services\Home\Blocks;

use App\Models\HomeBlock;
use App\Models\Platform;
use App\Services\Home\BlockProvider;

/** Source: `platforms` — tiles linking to the store filtered by platform, with in-stock counts. */
class PlatformTilesBlockProvider implements BlockProvider
{
    public function provide(HomeBlock $block): array
    {
        return ['items' => Platform::query()
            ->withCount(['products as products_count' => fn ($q) => $q->where('offers_count', '>', 0)])
            ->orderByDesc('products_count')->orderBy('name')
            ->get()
            ->filter(fn (Platform $p) => $p->products_count > 0)
            ->map(fn (Platform $p) => [
                'slug' => $p->slug,
                'name' => $p->name,
                'products_count' => $p->products_count,
                'url' => '/store?platform='.$p->slug,
            ])->values()->all()];
    }
}
