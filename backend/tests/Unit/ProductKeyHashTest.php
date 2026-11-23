<?php

namespace Tests\Unit;

use App\Models\ProductKey;
use Tests\TestCase;

class ProductKeyHashTest extends TestCase
{
    public function test_hash_ignores_case_dashes_and_spaces(): void
    {
        $this->assertSame(ProductKey::hashCode('ABCDE-FGHIJ-KLMNO'), ProductKey::hashCode(' abcde fghij-klmno '));
        $this->assertNotSame(ProductKey::hashCode('ABCDE-FGHIJ-KLMNO'), ProductKey::hashCode('ABCDE-FGHIJ-KLMNP'));
    }

    public function test_hash_is_keyed_not_plain_sha256(): void
    {
        // A plain hash of a short key could be brute-forced from a DB dump; HMAC needs APP_KEY.
        $this->assertNotSame(hash('sha256', 'ABCDEFGHIJKLMNO'), ProductKey::hashCode('ABCDE-FGHIJ-KLMNO'));
    }
}
