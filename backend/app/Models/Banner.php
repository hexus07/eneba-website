<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Banner extends Model
{
    use HasFactory;

    public const THEMES = ['violet', 'gold', 'teal'];

    protected $fillable = ['title', 'subtitle', 'theme', 'image_url', 'cta_label', 'cta_url', 'position', 'starts_at', 'ends_at', 'is_active'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'is_active' => 'boolean'];
    }

    /** Active and inside its (optional) scheduling window. */
    public function scopeLive(Builder $query): void
    {
        $now = now();
        $query->where('is_active', true)
            ->where(fn (Builder $q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(fn (Builder $q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', $now));
    }
}
