<?php

namespace App\Services\Home\Blocks;

use App\Models\Banner;
use App\Models\HomeBlock;
use App\Services\Home\BlockProvider;

/** Source: `banners` table (scheduled via starts_at / ends_at). Our own gradient + text banners: `theme` picks the gradient. */
class HeroBannerBlockProvider implements BlockProvider
{
    public function provide(HomeBlock $block): array
    {
        return [
            'items' => Banner::query()->live()->orderBy('position')->orderBy('id')
                ->limit((int) $block->setting('limit', 5))
                ->get()
                ->map(fn (Banner $b) => [
                    'id' => $b->id,
                    'title' => $b->title,
                    'subtitle' => $b->subtitle,
                    'theme' => $b->theme,
                    'image_url' => $b->image_url,
                    'cta' => ['label' => $b->cta_label, 'url' => $b->cta_url],
                ])->all(),
        ];
    }
}
