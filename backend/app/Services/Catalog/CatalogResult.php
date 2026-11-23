<?php

namespace App\Services\Catalog;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class CatalogResult
{
    /**
     * @param  array<string, list<array{slug: string, name: string, count: int, selected: bool}>>  $facets
     * @param  array{min: ?int, max: ?int}  $priceRange
     */
    public function __construct(
        public LengthAwarePaginator $products,
        public array $facets,
        public array $priceRange,
        public ?string $didYouMean = null,
    ) {}
}
