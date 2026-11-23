<?php

namespace App\Services\Home;

use Illuminate\Support\Collection;

/**
 * Each platform/region variant is its own product, so a popularity- or date-sorted row would show
 * "Satisfactory, Satisfactory, Satisfactory". Product blocks over-fetch in their own order, then keep
 * only the first (best-ranked) variant of each title.
 */
final class OnePerTitle
{
    /** How many rows to read per wanted card. 5 covers the seed's max of ~5 variants per title. */
    public const OVERFETCH = 5;

    /**
     * @template T
     *
     * @param  Collection<int, T>  $ranked  already in display order
     * @param  callable(T): string  $title
     * @return Collection<int, T>
     */
    public static function take(Collection $ranked, int $limit, callable $title): Collection
    {
        return $ranked->unique(fn ($item) => mb_strtolower($title($item)))->take($limit)->values();
    }
}
