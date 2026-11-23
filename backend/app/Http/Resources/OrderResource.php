<?php

namespace App\Http\Resources;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductKey;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Order */
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $completed = $this->status === OrderStatus::Completed;

        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'total_cents' => $this->total_cents,
            'currency' => $this->currency,
            'payment_provider' => $this->payment_provider,
            'failure_reason' => $this->failure_reason,
            // While pending: when the reserved keys are released if unpaid.
            'expires_at' => $this->expires_at,
            'created_at' => $this->created_at,
            'paid_at' => $this->paid_at,
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn (OrderItem $item) => [
                'id' => $item->id,
                'product_slug' => $item->product?->slug,
                'product_title' => $item->product_title,
                'cover_url' => $item->product?->cover_url,
                'platform_name' => $item->platform_name,
                'region_name' => $item->region_name,
                'seller_name' => $item->seller_name,
                'unit_price_cents' => $item->unit_price_cents,
                'quantity' => $item->quantity,
                'line_total_cents' => $item->unit_price_cents * $item->quantity,
                // Plaintext keys only for the owner's completed orders (controllers scope by user).
                'keys' => $completed && $item->relationLoaded('keys')
                    ? $item->keys->map(fn (ProductKey $key) => ['id' => $key->id, 'code' => $key->code])->all()
                    : [],
            ])->all()),
        ];
    }
}
