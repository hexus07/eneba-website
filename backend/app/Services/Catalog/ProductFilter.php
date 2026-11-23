<?php

namespace App\Services\Catalog;

use App\Models\Product;
use App\Services\Search\ProductSearch;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Catalog listing: filters + search + sort + pagination for GET /api/v1/products.
 */
class ProductFilter
{
    public const SORTS = ['relevance', 'popular', 'price_asc', 'price_desc', 'newest'];

    public const TYPES = ['game', 'dlc', 'gift_card', 'subscription', 'software'];

    public function __construct(private readonly ProductSearch $search) {}

    /** Facet dimensions: request param => [table, product FK or pivot]. */
    public const FACETS = ['platform', 'region', 'genre'];

    /**
     * Results page + facet counts + price range for the same query, in one search-threshold scope.
     *
     * @param array{
     *   q?: ?string, platform?: list<string>, region?: list<string>, genre?: list<string>, type?: list<string>,
     *   price_min?: ?int, price_max?: ?int, sort?: ?string, per_page?: ?int, page?: ?int
     * } $params
     */
    public function search(array $params): CatalogResult
    {
        $rawQ = trim((string) ($params['q'] ?? ''));
        $q = $this->search->normalize($rawQ);
        $sort = $params['sort'] ?? ($q !== '' ? 'relevance' : 'popular');
        if ($sort === 'relevance' && $q === '') {
            $sort = 'popular';
        }

        $perPage = (int) ($params['per_page'] ?? 24);
        $page = (int) ($params['page'] ?? 1);

        return $this->withSearchThreshold($q, function () use ($params, $rawQ, $q, $sort, $perPage, $page) {
            $query = $this->filtered($params, $rawQ, $q)->select('products.*')->with(['platform', 'region']);
            $this->applySort($query, $sort, $q);

            $products = $query->paginate($perPage, ['*'], 'page', $page);

            return new CatalogResult(
                products: $products,
                facets: array_combine(self::FACETS, array_map(fn ($d) => $this->facet($d, $params, $rawQ, $q), self::FACETS)),
                priceRange: $this->priceRange($params, $rawQ, $q),
                // Suggest within the other filters, so following the suggestion actually finds something.
                didYouMean: $products->total() === 0 && $q !== ''
                    ? $this->search->didYouMean($this->filtered([...$params, 'q' => null], '', ''), $q)
                    : null,
            );
        });
    }

    /** Back-compat wrapper: just the page of products. */
    public function paginate(array $params): LengthAwarePaginator
    {
        return $this->search($params)->products;
    }

    /**
     * Products matching the search and every filter, except the `$except` dimension. Facets use
     * that to count each dimension against the other filters only ("disjunctive" faceting): with
     * Steam selected, PSN still shows how many results ticking it would add, not 0.
     */
    private function filtered(array $params, string $rawQ, string $q, ?string $except = null): Builder
    {
        $query = Product::query();
        $this->applyFilters($query, $except === null ? $params : [...$params, $except => null]);

        if ($q !== '') {
            $this->search->apply($query, $q);
        } elseif ($rawQ !== '') {
            // Query consisted only of punctuation/symbols: nothing can match, don't fall back to "everything".
            $query->whereRaw('false');
        }

        return $query;
    }

    /** @return list<array{slug: string, name: string, count: int, selected: bool}> */
    private function facet(string $dimension, array $params, string $rawQ, string $q): array
    {
        $ids = $this->filtered($params, $rawQ, $q, $dimension)->select('products.id');
        $table = Str::plural($dimension);

        $rows = DB::table($table)
            ->when(
                $dimension === 'genre',
                fn ($b) => $b->join('genre_product', 'genre_product.genre_id', '=', 'genres.id')->whereIn('genre_product.product_id', $ids),
                fn ($b) => $b->join('products', "products.{$dimension}_id", '=', "{$table}.id")->whereIn('products.id', $ids),
            )
            ->groupBy("{$table}.id", "{$table}.slug", "{$table}.name")
            ->selectRaw("{$table}.slug, {$table}.name, COUNT(*) AS count")
            ->get();

        $selected = $params[$dimension] ?? [];

        // Keep selected options listed even at 0, so they can be unticked.
        $missing = array_diff($selected, $rows->pluck('slug')->all());
        if ($missing !== []) {
            $rows = $rows->concat(DB::table($table)->whereIn('slug', $missing)->get(['slug', 'name'])->map(fn ($r) => (object) [...(array) $r, 'count' => 0]));
        }

        return $rows
            ->map(fn ($r) => ['slug' => $r->slug, 'name' => $r->name, 'count' => (int) $r->count, 'selected' => in_array($r->slug, $selected, true)])
            ->sortBy([['count', 'desc'], ['name', 'asc']])
            ->values()
            ->all();
    }

    /** @return array{min: ?int, max: ?int} Price span of the current results, ignoring the price filter itself. */
    private function priceRange(array $params, string $rawQ, string $q): array
    {
        $row = $this->filtered([...$params, 'price_min' => null, 'price_max' => null], $rawQ, $q)
            ->toBase()
            ->selectRaw('MIN(products.min_price_cents) AS min, MAX(products.min_price_cents) AS max')
            ->first();

        return ['min' => $row?->min === null ? null : (int) $row->min, 'max' => $row?->max === null ? null : (int) $row->max];
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
