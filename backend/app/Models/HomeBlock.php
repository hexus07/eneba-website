<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HomeBlock extends Model
{
    use HasFactory;

    protected $fillable = ['key', 'type', 'title', 'position', 'config', 'is_active'];

    protected $attributes = ['config' => '{}', 'is_active' => true];

    protected function casts(): array
    {
        return ['config' => 'array', 'is_active' => 'boolean', 'position' => 'integer'];
    }

    /** Per-block setting with a provider default, e.g. $block->setting('limit', 12). */
    public function setting(string $key, mixed $default = null): mixed
    {
        return $this->config[$key] ?? $default;
    }
}
