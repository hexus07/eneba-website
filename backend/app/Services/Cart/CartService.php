<?php

namespace App\Services\Cart;

use App\Models\CartItem;
use App\Models\Offer;
use App\Models\User;
use App\Services\Catalog\Stock;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class CartService
{
    public function __construct(private readonly Stock $stock) {}

    /**
     * Cart lines with live price and `available_stock` set on each item.
     *
     * @return Collection<int, CartItem>
     */
    public function items(User $user): Collection
    {
        $items = $user->cartItems()
            ->with(['offer.product.platform', 'offer.product.region', 'offer.seller'])
            ->orderBy('id')
            ->get();

        $available = $this->stock->available($items->pluck('offer_id'));

        return $items->each(fn (CartItem $item) => $item->setAttribute(
            'available_stock',
            $item->offer->is_active ? $available[$item->offer_id] : 0,
        ));
    }

    /** "Add to cart": adds to the existing line's quantity. */
    public function add(User $user, int $offerId, int $quantity): CartItem
    {
        $item = $user->cartItems()->firstOrNew(['offer_id' => $offerId]);

        return $this->setQuantity($item, ($item->quantity ?? 0) + $quantity);
    }

    public function update(CartItem $item, int $quantity): CartItem
    {
        return $this->setQuantity($item, $quantity);
    }

    /**
     * Merge a guest (localStorage) cart after login. Best effort: unavailable lines are dropped and
     * quantities are clamped to stock, because the guest can't fix errors for items they no longer see.
     *
     * @param  list<array{offer_id: int, quantity: int}>  $lines
     */
    public function merge(User $user, array $lines): void
    {
        $offers = Offer::query()->active()->whereIn('id', array_column($lines, 'offer_id'))->pluck('id')->flip();
        $available = $this->stock->available($offers->keys());

        foreach ($lines as $line) {
            if (! isset($offers[$line['offer_id']])) {
                continue;
            }
            $item = $user->cartItems()->firstOrNew(['offer_id' => $line['offer_id']]);
            $quantity = min(($item->quantity ?? 0) + $line['quantity'], CartItem::MAX_QUANTITY, $available[$line['offer_id']]);
            if ($quantity > 0) {
                $item->fill(['quantity' => $quantity])->save();
            }
        }
    }

    private function setQuantity(CartItem $item, int $quantity): CartItem
    {
        $offer = Offer::query()->find($item->offer_id);
        if (! $offer?->is_active) {
            throw ValidationException::withMessages(['offer_id' => 'This offer is no longer available.']);
        }

        if ($quantity > CartItem::MAX_QUANTITY) {
            throw ValidationException::withMessages(['quantity' => 'You can buy at most '.CartItem::MAX_QUANTITY.' keys of one offer per order.']);
        }

        // Soft check for UX; the authoritative check happens at checkout and again at key assignment.
        $available = $this->stock->available([$offer->id])[$offer->id];
        if ($quantity > $available) {
            throw ValidationException::withMessages(['quantity' => $available === 0 ? 'This offer is out of stock.' : "Only {$available} left in stock."]);
        }

        $item->fill(['quantity' => $quantity])->save();

        return $item;
    }
}
