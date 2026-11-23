<?php

namespace Tests\Feature;

use App\Models\Genre;
use App\Models\Offer;
use App\Models\Platform;
use App\Models\Product;
use App\Models\ProductKey;
use App\Models\Region;
use App\Models\Seller;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductShowTest extends TestCase
{
    use RefreshDatabase;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->product = Product::factory()->withoutOffers()->titled('Elden Ring')->create([
            'slug' => 'elden-ring-steam-global',
            'platform_id' => Platform::factory()->create(['slug' => 'steam', 'name' => 'Steam']),
            'region_id' => Region::factory()->create(['slug' => 'global', 'name' => 'Global']),
            'developer' => 'FromSoftware',
        ]);
        $this->product->genres()->attach(Genre::factory()->create(['slug' => 'rpg', 'name' => 'RPG']));
    }

    private function offer(int $price, int $keys = 3, array $attrs = []): Offer
    {
        $offer = Offer::factory()->create(['product_id' => $this->product->id, 'price_cents' => $price] + $attrs);
        ProductKey::factory()->count($keys)->create(['offer_id' => $offer->id]);

        return $offer;
    }

    public function test_returns_product_details(): void
    {
        $this->getJson('/api/v1/products/elden-ring-steam-global')->assertOk()
            ->assertJsonPath('data.title', 'Elden Ring')
            ->assertJsonPath('data.platform.slug', 'steam')
            ->assertJsonPath('data.region.name', 'Global')
            ->assertJsonPath('data.developer', 'FromSoftware')
            ->assertJsonPath('data.genres', [['slug' => 'rpg', 'name' => 'RPG']])
            ->assertJsonStructure(['data' => ['id', 'slug', 'title', 'description', 'cover_url', 'publisher', 'release_date', 'min_price_cents', 'offers', 'variants']]);
    }

    public function test_offers_are_cheapest_first_with_seller_stock_and_discount(): void
    {
        $seller = Seller::factory()->create(['name' => 'PixelVault', 'rating' => 4.92, 'reviews_count' => 1000, 'is_verified' => true]);
        $this->offer(3000);
        $this->offer(1500, 4, ['seller_id' => $seller->id, 'original_price_cents' => 6000]);

        $this->getJson('/api/v1/products/elden-ring-steam-global')->assertOk()
            ->assertJsonCount(2, 'data.offers')
            ->assertJsonPath('data.offers.0.price_cents', 1500)
            ->assertJsonPath('data.offers.0.original_price_cents', 6000)
            ->assertJsonPath('data.offers.0.discount_percent', 75)
            ->assertJsonPath('data.offers.0.available_stock', 4)
            ->assertJsonPath('data.offers.0.seller', ['slug' => $seller->slug, 'name' => 'PixelVault', 'rating' => 4.92, 'reviews_count' => 1000, 'is_verified' => true])
            ->assertJsonPath('data.offers.1.price_cents', 3000)
            ->assertJsonPath('data.offers.1.discount_percent', null)
            ->assertJsonPath('data.min_price_cents', 1500);
    }

    public function test_inactive_and_out_of_stock_offers_are_not_listed(): void
    {
        $this->offer(1000, attrs: ['is_active' => false]);
        $this->offer(1200, keys: 0);
        $this->offer(2000);

        $this->getJson('/api/v1/products/elden-ring-steam-global')
            ->assertJsonCount(1, 'data.offers')->assertJsonPath('data.offers.0.price_cents', 2000);
    }

    public function test_lists_other_platform_and_region_variants_of_the_same_title(): void
    {
        $psn = Platform::factory()->create(['slug' => 'psn', 'name' => 'PSN']);
        $europe = Region::factory()->create(['slug' => 'europe', 'name' => 'Europe']);
        Product::factory()->titled('Elden Ring')->create(['platform_id' => $psn->id, 'region_id' => $europe->id, 'min_price_cents' => 2500]);
        Product::factory()->titled('Elden Ring: Shadow of the Erdtree')->create(); // different title: not a variant

        $this->getJson('/api/v1/products/elden-ring-steam-global')
            ->assertJsonCount(1, 'data.variants')
            ->assertJsonPath('data.variants.0.platform.slug', 'psn')
            ->assertJsonPath('data.variants.0.region.slug', 'europe')
            ->assertJsonPath('data.variants.0.min_price_cents', 2500);
    }

    public function test_never_exposes_key_codes(): void
    {
        $offer = $this->offer(1000, 1);

        $this->assertStringNotContainsString($offer->keys()->sole()->code, $this->getJson('/api/v1/products/elden-ring-steam-global')->getContent());
    }

    public function test_unknown_slug_is_404(): void
    {
        $this->getJson('/api/v1/products/does-not-exist')->assertNotFound();
        $this->getJson('/api/v1/products/BAD%20SLUG')->assertNotFound();
    }
}
