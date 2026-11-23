<?php

namespace App\Models;

use App\Enums\KeyStatus;
use App\Observers\OfferObserver;
use Illuminate\Database\Eloquent\Attributes\ObservedBy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A seller's listing for a product. Saving/deleting through Eloquent keeps
 * products.min_price_cents / offers_count in sync (OfferObserver). Mass updates
 * (Offer::query()->update()) bypass observers: run `php artisan catalog:sync-offer-stats` after them.
 */
#[ObservedBy(OfferObserver::class)]
class Offer extends Model
{
    use HasFactory;

    protected $fillable = ['product_id', 'seller_id', 'price_cents', 'original_price_cents', 'currency', 'is_active'];

    protected $attributes = ['currency' => 'EUR', 'is_active' => true];

    protected function casts(): array
    {
        return [
            'price_cents' => 'integer',
            'original_price_cents' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function keys(): HasMany
    {
        return $this->hasMany(ProductKey::class);
    }

    public function availableKeys(): HasMany
    {
        return $this->keys()->where('status', KeyStatus::Available);
    }

    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }
}
