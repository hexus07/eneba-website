<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductCardResource;
use App\Services\Catalog\ProductFilter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SearchController extends Controller
{
    public const LIMIT = 8;

    public function suggest(Request $request, ProductFilter $filter): AnonymousResourceCollection
    {
        $data = $request->validate(['q' => ['nullable', 'string', 'max:'.config('search.max_query_length')]]);

        return ProductCardResource::collection($filter->suggest((string) ($data['q'] ?? ''), self::LIMIT));
    }
}
