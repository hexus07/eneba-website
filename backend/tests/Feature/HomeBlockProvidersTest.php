<?php

namespace Tests\Feature;

use App\Models\Banner;
use App\Models\HomeBlock;
use App\Models\Offer;
use App\Models\Order;
use App\Models\Platform;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HomeBlockProvidersTest extends TestCase
{
    use RefreshDatabase;

    private function block(string $type, array $config = []): array
    {
        HomeBlock::factory()->create(['key' => 'b', 'type' => $type, 'config' => $config]);

        return $this->getJson('/api/v1/home/blocks/b')->assertOk()->json('data.items');
    }

    private function inStock(string $title, array $attrs = []): Product
    {
        return Product::factory()->titled($title)->create(['offers_count' => 2, 'min_price_cents' => 999] + $attrs);
    }

    /** Record N units of a product sold in a completed order paid $daysAgo days ago. */
    private function sold(Product $product, int $units, int $daysAgo = 1): void
    {
        $offer = Offer::factory()->create(['product_id' => $product->id]);
        $order = Order::factory()->for(User::factory())->create(['status' => 'completed', 'paid_at' => now()->subDays($daysAgo)]);
        $order->items()->create([
            'offer_id' => $offer->id, 'product_id' => $product->id, 'product_title' => $product->title, 'platform_name' => 'P',
            'region_name' => 'R', 'seller_name' => 'S', 'unit_price_cents' => 100, 'quantity' => $units,
        ]);
    }

    // ---- hero_banner ---------------------------------------------------------------------

    public function test_hero_banner_returns_live_banners_in_order(): void
    {
        Banner::factory()->create(['title' => 'Second', 'position' => 2]);
        Banner::factory()->create(['title' => 'First', 'position' => 1, 'cta_label' => 'Shop', 'cta_url' => '/store?platform=steam', 'theme' => 'violet']);
        Banner::factory()->create(['title' => 'Disabled', 'is_active' => false]);
        Banner::factory()->create(['title' => 'Not yet', 'starts_at' => now()->addDay()]);
        Banner::factory()->create(['title' => 'Expired', 'ends_at' => now()->subMinute()]);
        Banner::factory()->create(['title' => 'In window', 'position' => 3, 'starts_at' => now()->subDay(), 'ends_at' => now()->addDay()]);

        $items = $this->block('hero_banner');

        $this->assertSame(['First', 'Second', 'In window'], array_column($items, 'title'));
        $this->assertSame(['label' => 'Shop', 'url' => '/store?platform=steam'], $items[0]['cta']);
        $this->assertSame('violet', $items[0]['theme']);
        $this->assertNull($items[0]['image_url']);
    }

    public function test_banner_theme_is_constrained_in_the_database(): void
    {
        $this->expectException(QueryException::class);
        Banner::factory()->create(['theme' => 'neon']);
    }

    // ---- best_sellers --------------------------------------------------------------------

    public function test_best_sellers_ranks_recent_units_sold_above_all_time_sales_count(): void
    {
        $hyped = $this->inStock('Hyped', ['sales_count' => 9999]);   // popular historically, no recent sales
        $hot = $this->inStock('Hot', ['sales_count' => 1]);
        $warm = $this->inStock('Warm', ['sales_count' => 1]);
        $old = $this->inStock('Old News', ['sales_count' => 1]);
        $this->sold($hot, 5);
        $this->sold($warm, 2);
        $this->sold($warm, 1);
        $this->sold($old, 50, daysAgo: 60);   // outside the window

        $titles = array_column($this->block('best_sellers', ['limit' => 4, 'days' => 30]), 'title');

        $this->assertSame(['Hot', 'Warm', 'Hyped', 'Old News'], $titles, 'recent sellers first, then topped up by sales_count');
    }

    public function test_best_sellers_ignores_unpaid_orders_and_out_of_stock_products(): void
    {
        $pending = $this->inStock('Pending Only', ['sales_count' => 1]);
        $soldOut = $this->inStock('Sold Out', ['sales_count' => 5000, 'offers_count' => 0, 'min_price_cents' => null]);
        $this->inStock('Steady', ['sales_count' => 10]);
        $this->sold($soldOut, 99);
        $soldOut->offers->each->update(['is_active' => false]); // its last offer sold out → observer sets offers_count 0
        $this->sold($pending, 99);
        Order::query()->whereHas('items', fn ($q) => $q->where('product_id', $pending->id))->update(['status' => 'pending']);

        $titles = array_column($this->block('best_sellers', ['limit' => 2]), 'title');

        $this->assertSame(['Steady', 'Pending Only'], $titles);
    }

    // ---- deals ---------------------------------------------------------------------------

    public function test_deals_lists_biggest_discounts_one_per_product(): void
    {
        $a = Product::factory()->withoutOffers()->titled('Half Price')->create();
        $b = Product::factory()->withoutOffers()->titled('Eighty Off')->create();
        $c = Product::factory()->withoutOffers()->titled('Tiny Discount')->create();
        Offer::factory()->create(['product_id' => $a->id, 'price_cents' => 3000, 'original_price_cents' => 6000]);
        Offer::factory()->create(['product_id' => $b->id, 'price_cents' => 1000, 'original_price_cents' => 5000]);
        Offer::factory()->create(['product_id' => $b->id, 'price_cents' => 2500, 'original_price_cents' => 5000]); // same product, worse deal
        Offer::factory()->create(['product_id' => $c->id, 'price_cents' => 950, 'original_price_cents' => 1000]);  // 5%: under threshold
        Offer::factory()->inactive()->create(['product_id' => $c->id, 'price_cents' => 100, 'original_price_cents' => 1000]); // inactive

        $items = $this->block('deals', ['min_discount_percent' => 20]);

        $this->assertSame(['Eighty Off', 'Half Price'], array_column($items, 'title'));
        $this->assertSame(80, $items[0]['deal']['discount_percent']);
        $this->assertSame(1000, $items[0]['deal']['price_cents']);
        $this->assertSame(5000, $items[0]['deal']['original_price_cents']);
        $this->assertArrayHasKey('seller_name', $items[0]['deal']);
    }

    // ---- new_releases --------------------------------------------------------------------

    public function test_new_releases_are_newest_released_in_stock_games(): void
    {
        $this->inStock('Last Year', ['release_date' => now()->subYear()]);
        $this->inStock('Last Week', ['release_date' => now()->subWeek()]);
        $this->inStock('Upcoming', ['release_date' => now()->addMonth()]);
        $this->inStock('Gift Card', ['type' => 'gift_card', 'release_date' => now()->subDay()]);
        $this->inStock('No Date', ['release_date' => null]);
        Product::factory()->withoutOffers()->titled('Out Of Stock')->create(['release_date' => now()->subDay()]);

        $this->assertSame(['Last Week', 'Last Year'], array_column($this->block('new_releases'), 'title'));
    }

    public function test_limit_comes_from_block_config(): void
    {
        foreach (range(1, 5) as $i) {
            $this->inStock("Game $i", ['release_date' => now()->subDays($i)]);
        }

        $this->assertCount(3, $this->block('new_releases', ['limit' => 3]));
    }

    // ---- by_platform ---------------------------------------------------------------------

    public function test_by_platform_lists_in_stock_products_of_the_configured_platform_by_popularity(): void
    {
        $steam = Platform::factory()->create(['slug' => 'steam']);
        $psn = Platform::factory()->create(['slug' => 'psn']);
        $this->inStock('Steam Hit', ['platform_id' => $steam->id, 'sales_count' => 900]);
        $this->inStock('Steam Niche', ['platform_id' => $steam->id, 'sales_count' => 10]);
        $this->inStock('PSN Hit', ['platform_id' => $psn->id, 'sales_count' => 5000]);
        Product::factory()->withoutOffers()->titled('Steam Sold Out')->create(['platform_id' => $steam->id, 'sales_count' => 9999]);

        HomeBlock::factory()->create(['key' => 'b', 'type' => 'by_platform', 'config' => ['platform' => 'steam', 'limit' => 5]]);
        $data = $this->getJson('/api/v1/home/blocks/b')->assertOk()->json('data');

        $this->assertSame(['Steam Hit', 'Steam Niche'], array_column($data['items'], 'title'));
        $this->assertSame('/store?platform=steam', $data['see_all_url']);
    }

    public function test_by_platform_without_a_platform_is_empty(): void
    {
        $this->inStock('Anything');
        HomeBlock::factory()->create(['key' => 'b', 'type' => 'by_platform', 'config' => []]);

        $this->getJson('/api/v1/home/blocks/b')->assertOk()
            ->assertJsonPath('data.items', [])->assertJsonPath('data.see_all_url', null);
    }

    public function test_product_blocks_link_to_the_matching_store_view(): void
    {
        foreach (['best_sellers' => '/store?sort=popular', 'deals' => '/store?sort=price_asc', 'new_releases' => '/store?sort=newest'] as $type => $url) {
            HomeBlock::query()->delete();
            HomeBlock::factory()->create(['key' => 'b', 'type' => $type]);
            $this->getJson('/api/v1/home/blocks/b')->assertJsonPath('data.see_all_url', $url);
        }
    }

    // ---- platform_tiles ------------------------------------------------------------------

    public function test_platform_tiles_count_in_stock_products_and_link_to_store(): void
    {
        $steam = Platform::factory()->create(['slug' => 'steam', 'name' => 'Steam']);
        $psn = Platform::factory()->create(['slug' => 'psn', 'name' => 'PSN']);
        Platform::factory()->create(['slug' => 'empty', 'name' => 'Empty']);
        $this->inStock('A', ['platform_id' => $steam->id]);
        $this->inStock('B', ['platform_id' => $steam->id]);
        $this->inStock('C', ['platform_id' => $psn->id]);
        Product::factory()->withoutOffers()->create(['platform_id' => $psn->id]);

        $this->assertSame([
            ['slug' => 'steam', 'name' => 'Steam', 'products_count' => 2, 'url' => '/store?platform=steam'],
            ['slug' => 'psn', 'name' => 'PSN', 'products_count' => 1, 'url' => '/store?platform=psn'],
        ], $this->block('platform_tiles'));
    }
}
