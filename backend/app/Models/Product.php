<?php

namespace App\Models;

use App\Services\Search\SearchNormalizer;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'slug', 'title', 'type', 'platform_id', 'region_id', 'description', 'cover_url',
        'developer', 'publisher', 'release_date', 'min_price_cents', 'offers_count', 'sales_count',
    ];

    protected function casts(): array
    {
        return [
            'release_date' => 'date',
            'min_price_cents' => 'integer',
            'offers_count' => 'integer',
            'sales_count' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Product $product) {
            $product->search_title = SearchNormalizer::normalize($product->title);
        });
    }

    public function platform(): BelongsTo
    {
        return $this->belongsTo(Platform::class);
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function genres(): BelongsToMany
    {
        return $this->belongsToMany(Genre::class);
    }

    public function offers(): HasMany
    {
        return $this->hasMany(Offer::class);
    }

    public function activeOffers(): HasMany
    {
        return $this->offers()->where('is_active', true)->orderBy('price_cents');
    }
}
