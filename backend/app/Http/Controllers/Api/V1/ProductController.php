<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductIndexRequest;
use App\Http\Resources\ProductCardResource;
use App\Http\Resources\ProductDetailResource;
use App\Models\Offer;
use App\Models\Product;
use App\Services\Catalog\ProductFilter;
use App\Services\Catalog\Stock;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    public function index(ProductIndexRequest $request, ProductFilter $filter): AnonymousResourceCollection
    {
        $result = $filter->search($request->filters());

        return ProductCardResource::collection($result->products->withQueryString())->additional(['meta' => [
            'facets' => $result->facets,
            'price_range' => $result->priceRange,
            'did_you_mean' => $result->didYouMean,
        ]]);
    }

    public function show(string $slug, Stock $stock): ProductDetailResource
    {
        $product = Product::query()->where('slug', $slug)->with(['platform', 'region', 'genres'])->firstOrFail();

        $offers = $product->activeOffers()->with('seller')->orderBy('id')->get();
        $available = $stock->available($offers->pluck('id'));
        // Only offers a buyer can act on: active AND with keys left (normally the same thing, since
        // fulfillment deactivates sold-out offers; this also covers keys sold via bulk operations).
        $offers = $offers->each(fn (Offer $o) => $o->setAttribute('available_stock', $available[$o->id]))
            ->filter(fn (Offer $o) => $o->available_stock > 0)->values();

        $variants = Product::query()->where('title', $product->title)->whereKeyNot($product->id)
            ->with(['platform', 'region'])->get()
            ->sortBy(fn (Product $v) => [$v->platform->name, $v->region->name])->values();

        $product->setRelation('offers', $offers)->setRelation('variants', $variants);

        return new ProductDetailResource($product);
    }
}
