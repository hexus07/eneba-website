<?php

namespace Tests\Feature;

use App\Enums\KeyStatus;
use App\Models\ProductKey;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProductKeyTest extends TestCase
{
    use RefreshDatabase;

    public function test_code_is_encrypted_at_rest_and_hidden_from_serialization(): void
    {
        $key = ProductKey::factory()->create(['code' => 'ABCDE-FGHIJ-KLMNO']);

        $raw = DB::table('product_keys')->where('id', $key->id)->value('code');
        $this->assertStringNotContainsString('ABCDE', $raw);
        $this->assertSame('ABCDE-FGHIJ-KLMNO', $key->fresh()->code);
        $this->assertArrayNotHasKey('code', $key->toArray());
        $this->assertArrayNotHasKey('code_hash', $key->toArray());
        $this->assertSame(KeyStatus::Available, $key->fresh()->status);
    }

    public function test_duplicate_codes_are_rejected_even_with_different_formatting(): void
    {
        $key = ProductKey::factory()->create(['code' => 'ABCDE-FGHIJ-KLMNO']);

        $this->expectException(UniqueConstraintViolationException::class);
        ProductKey::factory()->create(['offer_id' => $key->offer_id, 'code' => 'abcde fghij klmno']);
    }

    public function test_status_is_constrained_in_the_database(): void
    {
        $key = ProductKey::factory()->create();

        $this->expectException(QueryException::class);
        DB::table('product_keys')->where('id', $key->id)->update(['status' => 'lost']);
    }
}
