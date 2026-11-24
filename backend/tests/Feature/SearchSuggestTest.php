<?php

namespace Tests\Feature;

use App\Models\Platform;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SearchSuggestTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['Cyberpunk 2077' => 900, 'Cyber Shadow' => 50, 'Elden Ring' => 800, 'Minecraft' => 700, 'Hades' => 300] as $title => $sales) {
            Product::factory()->titled($title)->create(['sales_count' => $sales]);
        }
    }

    private function suggest(string $q): array
    {
        return $this->getJson('/api/v1/search/suggest?q='.urlencode($q))->assertOk()->json('data.*.title');
    }

    public function test_tolerates_typos_and_ranks_like_the_catalog(): void
    {
        $this->assertSame('Cyberpunk 2077', $this->suggest('cyberpnk')[0]);
        $this->assertSame('Elden Ring', $this->suggest('elden rng')[0]);
        // Known limit: a typo in EVERY short word ("eldn rng", word_similarity 0.33) falls below the 0.5 threshold.
        $this->assertSame([], $this->suggest('eldn rng'));
        $this->assertSame(
            array_values(array_unique($this->getJson('/api/v1/products?q=cyber')->json('data.*.title'))),
            $this->getJson('/api/v1/search/suggest?q=cyber')->json('data.*.title'),
            'dropdown titles appear in the same order as in the full results',
        );
    }

    public function test_matches_partial_names(): void
    {
        $this->assertContains('Minecraft', $this->suggest('minec'));
        $this->assertContains('Hades', $this->suggest('ha'));
    }

    public function test_returns_at_most_eight(): void
    {
        foreach (range(1, 12) as $i) {
            Product::factory()->titled("Hollow Game $i")->create();
        }

        $this->assertCount(8, $this->suggest('hollow'));
    }

    public function test_excludes_products_without_offers(): void
    {
        Product::factory()->withoutOffers()->titled('Cyberpunk Soundtrack')->create();

        $this->assertNotContains('Cyberpunk Soundtrack', $this->suggest('cyberpunk'));
    }

    #[DataProvider('emptyQueries')]
    public function test_short_or_empty_queries_return_nothing(string $query): void
    {
        $this->getJson('/api/v1/search/suggest'.$query)->assertOk()->assertExactJson(['data' => []]);
    }

    public static function emptyQueries(): array
    {
        return ['missing' => [''], 'empty' => ['?q='], 'one char' => ['?q=c'], 'symbols' => ['?q=%25%25']];
    }

    public function test_returns_the_small_suggestion_shape_only(): void
    {
        $item = $this->getJson('/api/v1/search/suggest?q=hades')->assertOk()->json('data.0');

        $this->assertSame(['slug', 'title', 'cover_url', 'min_price_cents', 'currency', 'platform', 'variants_count'], array_keys($item));
        $this->assertSame(['slug', 'name'], array_keys($item['platform']));
    }

    public function test_rejects_overlong_query(): void
    {
        $this->getJson('/api/v1/search/suggest?q='.str_repeat('a', 101))->assertJsonValidationErrors('q');
    }

    public function test_one_row_per_title_linking_to_its_cheapest_in_stock_variant(): void
    {
        $psn = Platform::factory()->create(['slug' => 'psn', 'name' => 'PSN']);
        $xbox = Platform::factory()->create(['slug' => 'xbox', 'name' => 'Xbox Live']);
        $steam = Platform::factory()->create(['slug' => 'steam-x', 'name' => 'Steam']);
        foreach ([[$steam, 2000, 'stardew-steam'], [$psn, 1500, 'stardew-psn'], [$xbox, 1800, 'stardew-xbox']] as [$platform, $price, $slug]) {
            Product::factory()->titled('Stardew Valley')->create(['slug' => $slug, 'platform_id' => $platform->id, 'min_price_cents' => $price, 'offers_count' => 2, 'sales_count' => 10]);
        }
        // Cheaper, but nothing to buy: not the link target and not counted.
        Product::factory()->withoutOffers()->titled('Stardew Valley')->create(['min_price_cents' => 100]);

        $rows = $this->getJson('/api/v1/search/suggest?q=stardew')->assertOk()->json('data');

        $this->assertCount(1, $rows);
        $this->assertSame('stardew-psn', $rows[0]['slug']);
        $this->assertSame(1500, $rows[0]['min_price_cents']);
        $this->assertSame(3, $rows[0]['variants_count']);
        $this->assertSame(['slug' => 'psn', 'name' => 'PSN'], $rows[0]['platform']);
    }

    public function test_limits_to_eight_titles_however_many_variants_each_has(): void
    {
        foreach (range(1, 10) as $i) {
            foreach (range(1, 4) as $v) {
                Product::factory()->titled("Hollow Game $i")->create(['sales_count' => 100 - $i]);
            }
        }

        $rows = $this->getJson('/api/v1/search/suggest?q=hollow')->json('data');

        $this->assertCount(8, $rows);
        $this->assertCount(8, array_unique(array_column($rows, 'title')));
        $this->assertSame([4], array_values(array_unique(array_column($rows, 'variants_count'))));
    }
}
