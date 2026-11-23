<?php

namespace App\Services\Catalog;

use Illuminate\Support\Facades\DB;

/**
 * Maintains the denormalized products.min_price_cents / offers_count (cheapest and number of ACTIVE offers).
 *
 * Always recomputes from `offers` rather than applying deltas, so it is self-healing: any drift
 * (mass updates, a failed observer) is fixed by the next refresh of that product.
 */
class OfferStats
{
    /**
     * Recompute stats for the given products. Concurrency-safe:
     *
     * Two transactions adding offers to the same product would each aggregate without seeing the other's
     * uncommitted row, and the last writer would store a stale value. So we first take a row lock on the
     * product(s), and only then aggregate in a NEW statement — under READ COMMITTED that statement gets a
     * fresh snapshot, which includes everything committed by whoever held the lock before us.
     *
     * FOR NO KEY UPDATE (not FOR UPDATE): inserting an offer takes a FOR KEY SHARE lock on the product via
     * the FK check. FOR UPDATE conflicts with that, so two concurrent inserts would deadlock; NO KEY UPDATE
     * doesn't conflict with KEY SHARE but still serializes refreshers against each other.
     */
    public function refresh(int ...$productIds): void
    {
        $productIds = array_values(array_unique(array_filter($productIds)));
        if ($productIds === []) {
            return;
        }
        sort($productIds); // consistent lock order → no deadlocks when one save touches two products

        DB::transaction(function () use ($productIds) {
            DB::table('products')->whereIn('id', $productIds)->orderBy('id')->lock('FOR NO KEY UPDATE')->pluck('id');

            $this->recompute('WHERE p.id IN ('.implode(',', array_fill(0, count($productIds), '?')).')', $productIds);
        });
    }

    /** Recompute every product. Used by the seeder and `catalog:sync-offer-stats` after bulk writes. */
    public function refreshAll(): int
    {
        return $this->recompute('', []);
    }

    private function recompute(string $where, array $bindings): int
    {
        // IS DISTINCT FROM: skip no-op writes so unchanged rows aren't rewritten (and their indexes untouched).
        return DB::update(<<<SQL
            UPDATE products AS p
            SET min_price_cents = s.min_price_cents, offers_count = s.offers_count
            FROM (
                SELECT p.id,
                       MIN(o.price_cents) FILTER (WHERE o.is_active) AS min_price_cents,
                       COUNT(o.id)        FILTER (WHERE o.is_active) AS offers_count
                FROM products p
                LEFT JOIN offers o ON o.product_id = p.id
                {$where}
                GROUP BY p.id
            ) AS s
            WHERE p.id = s.id
              AND (p.min_price_cents IS DISTINCT FROM s.min_price_cents OR p.offers_count IS DISTINCT FROM s.offers_count)
            SQL, $bindings);
    }
}
