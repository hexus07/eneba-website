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

            $this->recompute('p.id IN ('.implode(',', array_fill(0, count($productIds), '?')).')', $productIds);
        });
    }

    /** Recompute every product. Used by the seeder and `catalog:sync-offer-stats` after bulk writes. */
    public function refreshAll(): int
    {
        return $this->recompute('TRUE', []);
    }

    /**
     * Per-product correlated subqueries, each answered from the (product_id, is_active, price_cents)
     * index. Deliberately NOT "UPDATE … FROM (products ⋈ offers GROUP BY)": that self-join form
     * intermittently ran for minutes at 100% CPU in the test suite (root cause not pinned down; see
     * PLAN.md "Open issues"). This shape bounds the work to two index lookups per product whatever
     * plan the planner picks.
     */
    private function recompute(string $condition, array $bindings): int
    {
        $active = 'SELECT MIN(o.price_cents) AS m, COUNT(*) AS c FROM offers o WHERE o.product_id = p.id AND o.is_active';

        // The EXISTS(… IS DISTINCT FROM …) guard skips no-op writes, so unchanged rows aren't
        // rewritten (and their indexes, including the trigram GIN, aren't touched).
        return DB::update(<<<SQL
            UPDATE products AS p
            SET (min_price_cents, offers_count) = (SELECT s.m, s.c FROM ({$active}) AS s)
            WHERE {$condition}
              AND EXISTS (
                  SELECT 1 FROM ({$active}) AS s
                  WHERE p.min_price_cents IS DISTINCT FROM s.m OR p.offers_count IS DISTINCT FROM s.c
              )
            SQL, $bindings);
    }
}
