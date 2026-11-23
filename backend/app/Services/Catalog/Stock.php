<?php

namespace App\Services\Catalog;

use App\Enums\KeyStatus;
use App\Models\ProductKey;

class Stock
{
    /**
     * Available key counts per offer (offers with no stock are present with 0).
     *
     * @param  iterable<int>  $offerIds
     * @return array<int, int>
     */
    public function available(iterable $offerIds): array
    {
        $ids = collect($offerIds)->unique()->values();
        if ($ids->isEmpty()) {
            return [];
        }

        $counts = ProductKey::query()
            ->whereIn('offer_id', $ids)
            ->where('status', KeyStatus::Available)
            ->groupBy('offer_id')
            ->selectRaw('offer_id, count(*) AS n')
            ->pluck('n', 'offer_id');

        return $ids->mapWithKeys(fn ($id) => [$id => (int) ($counts[$id] ?? 0)])->all();
    }
}
