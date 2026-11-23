<?php

namespace App\Services\Catalog;

use App\Models\Product;
use App\Services\Search\ProductSearch;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Catalog listing: filters + search + sort + pagination for GET /api/v1/products.
 */
class ProductFilter
{
    public const SORTS = ['relevance', 'popular', 'price_asc', 'price_desc', 'newest'];

    public const TYPES = ['game', 'dlc', 'gift_card', 'subscription', 'software'];

    public function __construct(private readonly ProductSearch $search) {}

    /**
     * @param array{
     *   q?: ?string, platform?: list<string>, region?: list<string>, genre?: list<string>, type?: list<string>,
     *   price_min?: ?int, price_max?: ?int, sort?: ?string, per_page?: ?int, page?: ?int
     * } $params
     */
    public function paginate(array $params): LengthAwarePaginator
    {
        $rawQ = trim((string) ($params['q'] ?? ''));
        $q = $this->search->normalize($rawQ);
        $sort = $params['sort'] ?? ($q !== '' ? 'relevance' : 'popular');
        if ($sort === 'relevance' && $q === '') {
            $sort = 'popular';
        }

        $query = Product::query()->select('products.*')->with(['platform', 'region']);

        $this->applyFilters($query, $params);

        if ($q !== '') {
            $this->search->apply($query, $q);
        } elseif ($rawQ !== '') {
            // Query consisted only of punctuation/symbols: nothing can match, don't fall back to "everything".
            $query->whereRaw('false');
        }

        $this->applySort($query, $sort, $q);

        $perPage = (int) ($params['per_page'] ?? 24);
        $page = (int) ($params['page'] ?? 1);

        return $this->withSearchThreshold($q, fn () => $query->paginate($perPage, ['*'], 'page', $page));
    }

    /**
     * Header autocomplete: same matching and ranking as the catalog's `q`, so the dropdown and the
     * full results page always agree. Only purchasable products; no count query.
     *
     * @return Collection<int, Product>
     */
    public function suggest(string $rawQuery, int $limit): Collection
    {
        $q = $this->search->normalize($rawQuery);
        if (mb_strlen($q) < 2) {
            return new Collection;
        }

        $query = Product::query()->select('products.*')->with('platform')->where('products.offers_count', '>', 0);
        $this->search->apply($query, $q);
        $this->search->orderByRelevance($query, $q);

        return $this->withSearchThreshold($q, fn () => $query->limit($limit)->get());
    }

    /**
     * The `<%` operator reads its threshold from a GUC. Setting it with is_local = true scopes it
     * to this transaction, so it never leaks to other requests sharing a pooled connection (Neon).
     */
    private function withSearchThreshold(string $q, callable $run): mixed
    {
        if ($q === '' || ! $this->search->usesFuzzy($q)) {
            return $run();
        }

        return DB::transaction(function () use ($run) {
            DB::select("SELECT set_config('pg_trgm.word_similarity_threshold', ?, true)", [
                (string) config('search.word_similarity_threshold'),
            ]);

            return $run();
        });
    }

    private function applyFilters(Builder $query, array $params): void
    {
        if (! empty($params['platform'])) {
            $query->whereHas('platform', fn (Builder $p) => $p->whereIn('slug', $params['platform']));
        }

        if (! empty($params['region'])) {
            $query->whereHas('region', fn (Builder $r) => $r->whereIn('slug', $params['region']));
        }

        // Within one dimension values are OR'd (rpg OR indie); dimensions are AND'd.
        if (! empty($params['genre'])) {
            $query->whereHas('genres', fn (Builder $g) => $g->whereIn('slug', $params['genre']));
        }

        if (! empty($params['type'])) {
            $query->whereIn('products.type', $params['type']);
        }

        if (isset($params['price_min'])) {
            $query->where('products.min_price_cents', '>=', $params['price_min']);
        }

        if (isset($params['price_max'])) {
            $query->where('products.min_price_cents', '<=', $params['price_max']);
        }
    }

    private function applySort(Builder $query, string $sort, string $q): void
    {
        match ($sort) {
            'relevance' => $this->search->orderByRelevance($query, $q),
            'price_asc' => $query->orderByRaw('products.min_price_cents ASC NULLS LAST'),
            'price_desc' => $query->orderByRaw('products.min_price_cents DESC NULLS LAST'),
            'newest' => $query->orderByRaw('products.release_date DESC NULLS LAST'),
            'popular' => $query->orderByDesc('products.sales_count'),
        };

        // Deterministic tie-breaker so pagination never repeats or skips rows.
        if ($sort !== 'relevance') {
            $query->orderBy('products.id');
        }
    }
}
