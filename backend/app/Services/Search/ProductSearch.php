<?php

namespace App\Services\Search;

use Illuminate\Database\Eloquent\Builder;

/**
 * Name search over products.search_title. A product matches when EITHER holds:
 *   1. ILIKE substring/prefix match              ("cyber", "punk 20" → "Cyberpunk 2077")
 *   2. pg_trgm word similarity ≥ threshold (<%)  ("cyberpnk"         → "Cyberpunk 2077")
 * (1) is the fallback for partial names and short queries where trigrams are weak;
 * (2) gives typo tolerance. Both are served by the same GIN gin_trgm_ops index.
 *
 * The threshold for (2) is read by the `<%` operator from the pg_trgm.word_similarity_threshold
 * GUC; ProductFilter sets it transaction-locally before running the query.
 */
class ProductSearch
{
    public function normalize(string $query): string
    {
        return SearchNormalizer::normalize(mb_substr($query, 0, config('search.max_query_length')));
    }

    public function usesFuzzy(string $normalized): bool
    {
        return mb_strlen(str_replace(' ', '', $normalized)) >= config('search.min_fuzzy_length');
    }

    /** Restrict the query to matching products. `$normalized` must come from normalize(). */
    public function apply(Builder $query, string $normalized): Builder
    {
        return $query->where(function (Builder $where) use ($normalized) {
            // ILIKE fallback: substring match covers prefixes ("cyber") and partials ("punk 20").
            $where->whereRaw('products.search_title ILIKE ?', ['%'.$this->escapeLike($normalized).'%']);

            if ($this->usesFuzzy($normalized)) {
                $where->orWhereRaw('? <% products.search_title', [$normalized]);
            }
        });
    }

    /**
     * Order by relevance: titles starting with the query, then word-prefix matches, then
     * word_similarity + similarity, then popularity as a tie-breaker.
     *
     * word_similarity alone ties too often on short typos: "eldn" scores 0.600 against "Elden Ring",
     * "Elden Ring: Shadow of the Erdtree" AND "The Elder Scrolls V: Skyrim" (each shares the same 3 of
     * its 5 trigrams), so popularity decided and Skyrim won. Whole-string similarity() separates them
     * (0.231 vs 0.071). Same score as didYouMean(), so both rank alike.
     */
    public function orderByRelevance(Builder $query, string $normalized): Builder
    {
        $escaped = $this->escapeLike($normalized);

        return $query
            ->orderByRaw('(products.search_title LIKE ?) DESC', [$escaped.'%'])
            ->orderByRaw('(products.search_title LIKE ?) DESC', ['% '.$escaped.'%'])
            ->orderByRaw('(word_similarity(?, products.search_title) + similarity(?, products.search_title)) DESC', [$normalized, $normalized])
            ->orderByDesc('products.sales_count')
            ->orderBy('products.id');
    }

    /**
     * Closest title to a query that found nothing, among the products in `$scope` (the other active
     * filters), or null when nothing is close enough. Combining whole-string similarity with
     * word_similarity ranks "eldn rng" → "Elden Ring" (0.67) above "The Elder Scrolls…" (0.40),
     * which word_similarity alone ties at 0.33. Unindexed scan, but it only runs on zero results.
     */
    public function didYouMean(Builder $scope, string $normalized): ?string
    {
        $score = '(similarity(?, products.search_title) + word_similarity(?, products.search_title))';

        return $scope
            ->select('products.title')
            ->whereRaw("{$score} >= ?", [$normalized, $normalized, config('search.did_you_mean_min_score')])
            ->orderByRaw("{$score} DESC", [$normalized, $normalized])
            ->orderByDesc('products.sales_count')
            ->orderBy('products.id')
            ->value('products.title');
    }

    private function escapeLike(string $value): string
    {
        // The normalizer already strips % and _, but escape defensively in case it changes.
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
