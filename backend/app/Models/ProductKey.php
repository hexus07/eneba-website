<?php

namespace App\Models;

use App\Enums\KeyStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class ProductKey extends Model
{
    use HasFactory;

    protected $fillable = ['offer_id', 'code', 'status', 'reserved_until', 'order_item_id', 'revealed_at'];

    // Never serialize the plaintext key by accident; the reveal endpoint returns it explicitly.
    protected $hidden = ['code', 'code_hash'];

    protected $attributes = ['status' => 'available'];

    protected function casts(): array
    {
        return [
            'code' => 'encrypted',
            'status' => KeyStatus::class,
            'reserved_until' => 'datetime',
            'revealed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (ProductKey $key) {
            if ($key->isDirty('code')) {
                $key->code_hash = static::hashCode($key->code);
            }
        });
    }

    /** Deterministic fingerprint for uniqueness: "abcde-fghij" and "ABCDEFGHIJ" are the same key. */
    public static function hashCode(string $code): string
    {
        $normalized = strtoupper(preg_replace('/[\s\-]/', '', $code));

        return hash_hmac('sha256', $normalized, (string) config('app.key'));
    }

    /**
     * Column values for a bulk insert (seeding / imports), matching what the `encrypted` cast
     * and saving hook produce for a single save.
     *
     * @return array{offer_id: int, code: string, code_hash: string, status: string}
     */
    public static function rowFor(int $offerId, string $code): array
    {
        return [
            'offer_id' => $offerId,
            'code' => Crypt::encryptString($code),
            'code_hash' => static::hashCode($code),
            'status' => KeyStatus::Available->value,
        ];
    }

    public function offer(): BelongsTo
    {
        return $this->belongsTo(Offer::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }
}
