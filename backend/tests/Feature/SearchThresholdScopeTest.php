<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\CommitsToDatabase;
use Tests\TestCase;

/**
 * Runs WITHOUT RefreshDatabase's wrapping transaction, so the request's DB::transaction is a real
 * top-level transaction — exactly as in production behind Neon's transaction-mode pooler.
 */
class SearchThresholdScopeTest extends TestCase
{
    use CommitsToDatabase;

    public function test_similarity_threshold_is_scoped_to_the_request_transaction(): void
    {
        Product::factory()->titled('Cyberpunk 2077')->create();
        $setting = fn () => DB::selectOne("SELECT current_setting('pg_trgm.word_similarity_threshold') AS v")->v;
        $before = $setting();

        $this->getJson('/api/v1/products?q=cyberpnk')->assertOk()->assertJsonPath('data.0.title', 'Cyberpunk 2077');

        $this->assertSame($before, $setting());
        $this->assertNotSame((string) config('search.word_similarity_threshold'), $before, 'precondition: config differs from server default');
    }
}
