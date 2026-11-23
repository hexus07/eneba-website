<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Seller extends Model
{
    use HasFactory;

    protected $fillable = ['slug', 'name', 'rating', 'reviews_count', 'is_verified'];

    protected function casts(): array
    {
        return [
            'rating' => 'decimal:2',
            'reviews_count' => 'integer',
            'is_verified' => 'boolean',
        ];
    }

    public function offers(): HasMany
    {
        return $this->hasMany(Offer::class);
    }
}
