<?php

namespace Tests\Feature;

use App\Models\Offer;
use App\Models\Product;
use App\Models\Seller;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class OfferObserverTest extends TestCase
{
    use RefreshDatabase;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->product = Product::factory()->withoutOffers()->create();
    }

    private function offer(int $price, array $attrs = []): Offer
    {
        return Offer::factory()->create(array_merge([
            'product_id' => $this->product->id,
            'price_cents' => $price,
        ], $attrs));
    }

    private function assertStats(?int $minPrice, int $count, ?Product $product = null): void
    {
        $product = ($product ?? $this->product)->fresh();
        $this->assertSame($minPrice, $product->min_price_cents, 'min_price_cents');
        $this->assertSame($count, $product->offers_count, 'offers_count');
    }

    public function test_first_offer_sets_stats(): void
    {
        $this->assertStats(null, 0);

        $this->offer(2999);

        $this->assertStats(2999, 1);
    }

    public function test_cheaper_offer_lowers_min_and_pricier_offer_only_bumps_count(): void
    {
        $this->offer(2999);
        $this->offer(1999);
        $this->assertStats(1999, 2);

        $this->offer(4999);
        $this->assertStats(1999, 3);
    }

    public function test_inactive_offer_is_not_counted(): void
    {
        $this->offer(2999);
        $this->offer(999, ['is_active' => false]);

        $this->assertStats(2999, 1);
    }

    public function test_price_change_is_reflected_in_both_directions(): void
    {
        $cheapest = $this->offer(1000);
        $this->offer(2000);

        $cheapest->update(['price_cents' => 500]);
        $this->assertStats(500, 2);

        // Raising the cheapest above the other: min must move to the *other* offer, not just follow this one.
        $cheapest->update(['price_cents' => 3000]);
        $this->assertStats(2000, 2);
    }

    public function test_deactivating_and_reactivating_cheapest_offer(): void
    {
        $cheapest = $this->offer(1000);
        $this->offer(2000);

        $cheapest->update(['is_active' => false]);
        $this->assertStats(2000, 1);

        $cheapest->update(['is_active' => true]);
        $this->assertStats(1000, 2);
    }

    public function test_deactivating_all_offers_clears_min_price(): void
    {
        $a = $this->offer(1000);
        $b = $this->offer(2000);

        $a->update(['is_active' => false]);
        $b->update(['is_active' => false]);

        $this->assertStats(null, 0);
    }

    public function test_deleting_offers(): void
    {
        $cheapest = $this->offer(1000);
        $other = $this->offer(2000);

        $cheapest->delete();
        $this->assertStats(2000, 1);

        $other->delete();
        $this->assertStats(null, 0);
    }

    public function test_moving_offer_to_another_product_updates_both(): void
    {
        $target = Product::factory()->withoutOffers()->create();
        $moving = $this->offer(1000);
        $this->offer(2000);

        $moving->update(['product_id' => $target->id]);

        $this->assertStats(2000, 1);
        $this->assertStats(1000, 1, $target);
    }

    public function test_other_products_are_untouched(): void
    {
        $bystander = Product::factory()->create(['min_price_cents' => 4242, 'offers_count' => 7]);

        $this->offer(1000);

        // Factory-set stats on a product without offers stay as-is: only the affected product is recomputed.
        $this->assertStats(4242, 7, $bystander);
    }

    public function test_changing_untracked_fields_skips_recompute(): void
    {
        $offer = $this->offer(1000);

        DB::enableQueryLog();
        $offer->update(['original_price_cents' => 1500]);
        $queries = collect(DB::getQueryLog())->pluck('query');
        DB::disableQueryLog();

        $this->assertCount(1, $queries, 'only the offer UPDATE itself: '.$queries->implode(' | '));
        $this->assertStringStartsWith('update "offers"', $queries->first());
    }

    public function test_recompute_does_not_trust_existing_stale_values(): void
    {
        // Simulate drift (e.g. a manual SQL fix) — the next observed change must heal it, not build on it.
        $this->offer(1000);
        DB::table('products')->where('id', $this->product->id)->update(['min_price_cents' => 1, 'offers_count' => 99]);

        $this->offer(2000);

        $this->assertStats(1000, 2);
    }

    public function test_mass_update_bypasses_observer_and_sync_command_repairs_it(): void
    {
        $this->offer(1000);
        $this->offer(2000);

        Offer::query()->where('product_id', $this->product->id)->update(['price_cents' => 300]);
        $this->assertStats(1000, 2); // documented limitation: query-builder updates fire no model events

        $this->artisan('catalog:sync-offer-stats')->expectsOutputToContain('1 product(s) updated.')->assertSuccessful();
        $this->assertStats(300, 2);

        $this->artisan('catalog:sync-offer-stats')->expectsOutputToContain('0 product(s) updated.');
    }

    public function test_stats_feed_catalog_price_filter_and_sort(): void
    {
        $cheap = Product::factory()->withoutOffers()->titled('Cheap Game')->create();
        $pricey = Product::factory()->withoutOffers()->titled('Pricey Game')->create();
        Offer::factory()->create(['product_id' => $cheap->id, 'price_cents' => 500]);
        Offer::factory()->create(['product_id' => $pricey->id, 'price_cents' => 4000]);
        Offer::factory()->create(['product_id' => $pricey->id, 'price_cents' => 900, 'seller_id' => Seller::factory()]);

        $this->getJson('/api/v1/products?sort=price_asc&price_min=100')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Cheap Game')
            ->assertJsonPath('data.1.title', 'Pricey Game')
            ->assertJsonPath('data.1.min_price_cents', 900)
            ->assertJsonPath('data.1.offers_count', 2);
    }
}
