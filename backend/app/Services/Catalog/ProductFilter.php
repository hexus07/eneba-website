<?php

namespace App\Services\Catalog;

use App\Models\Product;
use App\Services\Search\ProductSearch;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Catalog listing: filters + search + sort + pagination for GET /api/v1/products.
 */
class ProductFilter
{
    public const SORTS = ['relevance', 'popular', 'price_asc', 'price_desc', 'newest'];

    public function __construct(private readonly ProductSearch $search) {}

    /**
     * @param array{
     *   q?: ?string, platform?: list<string>, region?: list<string>,
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

        if ($q === '' || ! $this->search->usesFuzzy($q)) {
            return $query->paginate($perPage, ['*'], 'page', $page);
        }

        // The `<%` operator reads its threshold from a GUC. Setting it with is_local = true scopes it
        // to this transaction, so it never leaks to other requests sharing a pooled connection (Neon).
        return DB::transaction(function () use ($query, $perPage, $page) {
            DB::select("SELECT set_config('pg_trgm.word_similarity_threshold', ?, true)", [
                (string) config('search.word_similarity_threshold'),
            ]);

            return $query->paginate($perPage, ['*'], 'page', $page);
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
