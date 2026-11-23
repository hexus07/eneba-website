<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductIndexRequest;
use App\Http\Resources\ProductCardResource;
use App\Services\Catalog\ProductFilter;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    public function index(ProductIndexRequest $request, ProductFilter $filter): AnonymousResourceCollection
    {
        $products = $filter->paginate($request->filters())->withQueryString();

        return ProductCardResource::collection($products);
    }
}
