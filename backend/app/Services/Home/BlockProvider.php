<?php

namespace App\Services\Home;

use App\Models\HomeBlock;

/**
 * One implementation per homepage block type. Each provider owns its data source and query;
 * the homepage controller and the frontend know nothing about what's inside a block.
 */
interface BlockProvider
{
    /**
     * Block payload (merged into the response next to key/type/title).
     * Product lists must only contain products that can be bought right now.
     *
     * @return array<string, mixed>
     */
    public function provide(HomeBlock $block): array;
}
