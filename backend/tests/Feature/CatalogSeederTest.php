<?php

namespace Tests\Feature;

use App\Models\Offer;
use App\Models\Platform;
use App\Models\Product;
use App\Models\ProductKey;
use App\Models\Region;
use App\Models\Seller;
use Database\Seeders\CatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CatalogSeederTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Seeding takes ~1.5s, so the invariant checks share one seeded database
     * instead of reseeding per test method.
     */
    public function test_seeded_catalog_satisfies_plan_and_invariants(): void
    {
        $this->seed(CatalogSeeder::class);

        $this->assertPlannedSize();
        $this->assertEveryProductHasTwoToSixOffers();
        $this->assertOfferStatsMatchActiveOffers();
        $this->assertKeysAreEncryptedUniqueAndWellFormed();
        $this->assertVariantsArePlatformAndRegionSpecific();
    }

    private function assertPlannedSize(): void
    {
        $this->assertSame(8, Platform::count());
        $this->assertSame(5, Region::count());
        $this->assertSame(12, Seller::count());
        $this->assertGreaterThanOrEqual(80, Product::query()->distinct()->count('title'));
        $this->assertGreaterThanOrEqual(250, Product::count());
    }

    private function assertEveryProductHasTwoToSixOffers(): void
    {
        $counts = Offer::query()->selectRaw('count(*) c')->groupBy('product_id')->pluck('c');

        $this->assertSame(Product::count(), $counts->count(), 'every product has offers');
        $this->assertGreaterThanOrEqual(2, $counts->min());
        $this->assertLessThanOrEqual(6, $counts->max());
    }

    private function assertOfferStatsMatchActiveOffers(): void
    {
        $drift = DB::selectOne(<<<'SQL'
            SELECT count(*) AS n FROM products p
            LEFT JOIN LATERAL (
                SELECT min(price_cents) AS m, count(*) AS c FROM offers o WHERE o.product_id = p.id AND o.is_active
            ) s ON true
            WHERE p.min_price_cents IS DISTINCT FROM s.m OR p.offers_count <> s.c
            SQL)->n;

        $this->assertSame(0, $drift);
        $this->assertTrue(Offer::where('is_active', false)->exists(), 'seed includes inactive offers');
    }

    private function assertKeysAreEncryptedUniqueAndWellFormed(): void
    {
        $this->assertSame(0, Offer::query()->doesntHave('keys')->count(), 'every offer has stock');

        $key = ProductKey::query()->firstOrFail();
        $raw = $key->getRawOriginal('code');

        $this->assertMatchesRegularExpression('/^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/', $key->code);
        $this->assertNotSame($key->code, $raw, 'stored value is ciphertext');
        $this->assertStringNotContainsString($key->code, $raw);
        $this->assertSame(ProductKey::hashCode($key->code), $key->code_hash);
        $this->assertSame(ProductKey::count(), ProductKey::query()->distinct()->count('code_hash'));
    }

    private function assertVariantsArePlatformAndRegionSpecific(): void
    {
        $cyberpunk = Product::query()->where('title', 'Cyberpunk 2077')->with('platform', 'region')->get();

        $this->assertGreaterThan(1, $cyberpunk->count());
        $this->assertSame(
            $cyberpunk->count(),
            $cyberpunk->map(fn ($p) => $p->platform->slug.'/'.$p->region->slug)->unique()->count(),
        );
        $this->assertNotEmpty($cyberpunk->first()->genres);
    }

    public function test_is_deterministic(): void
    {
        $this->seed(CatalogSeeder::class);
        $snapshot = fn () => Product::query()->orderBy('slug')->get(['slug', 'min_price_cents', 'sales_count'])->toArray();
        $first = $snapshot();

        DB::table('product_keys')->delete();
        DB::table('offers')->delete();
        DB::table('genre_product')->delete();
        DB::table('products')->delete();
        DB::table('sellers')->delete();
        $this->seed(CatalogSeeder::class);

        $this->assertSame($first, $snapshot());
    }

    public function test_reseeding_a_seeded_database_is_a_no_op(): void
    {
        $this->seed(CatalogSeeder::class);
        $before = Product::count();

        $this->seed(CatalogSeeder::class);

        $this->assertSame($before, Product::count());
    }
}
