<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cart\AddCartItemRequest;
use App\Http\Requests\Cart\MergeCartRequest;
use App\Http\Requests\Cart\UpdateCartItemRequest;
use App\Http\Resources\CartItemResource;
use App\Models\CartItem;
use App\Services\Cart\CartService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class CartController extends Controller
{
    public function __construct(private readonly CartService $cart) {}

    public function show(Request $request): JsonResponse
    {
        return $this->cartResponse($request);
    }

    public function store(AddCartItemRequest $request): JsonResponse
    {
        $this->cart->add($request->user(), (int) $request->validated('offer_id'), (int) $request->validated('quantity', 1));

        return $this->cartResponse($request, 201);
    }

    public function update(UpdateCartItemRequest $request, int $cartItem): JsonResponse
    {
        $this->cart->update($this->ownItem($request, $cartItem), (int) $request->validated('quantity'));

        return $this->cartResponse($request);
    }

    public function destroy(Request $request, int $cartItem): JsonResponse
    {
        $this->ownItem($request, $cartItem)->delete();

        return $this->cartResponse($request);
    }

    /** Public: price a guest's localStorage cart (same response shape as GET /cart, nothing stored). */
    public function preview(MergeCartRequest $request): JsonResponse
    {
        return $this->respond($this->cart->preview($request->validated('items')));
    }

    public function merge(MergeCartRequest $request): JsonResponse
    {
        $this->cart->merge($request->user(), $request->validated('items'));

        return $this->cartResponse($request);
    }

    /** Scoped lookup: another user's item id is a 404, not a 403 (don't confirm it exists). */
    private function ownItem(Request $request, int $id): CartItem
    {
        return $request->user()->cartItems()->findOrFail($id);
    }

    private function cartResponse(Request $request, int $status = 200): JsonResponse
    {
        return $this->respond($this->cart->items($request->user()), $status);
    }

    /** @param Collection<int, CartItem> $items */
    private function respond(Collection $items, int $status = 200): JsonResponse
    {
        return response()->json(['data' => [
            'items' => CartItemResource::collection($items),
            'totals' => [
                'items_count' => $items->sum('quantity'),
                'subtotal_cents' => $items->sum(fn (CartItem $i) => $i->offer->price_cents * $i->quantity),
                'currency' => config('payments.currency'),
                'is_purchasable' => $items->isNotEmpty() && $items->every(fn (CartItem $i) => $i->quantity <= $i->available_stock),
            ],
        ]], $status);
    }
}
