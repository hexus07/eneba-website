<?php

namespace Tests\Feature;

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
            $this->getJson('/api/v1/products?q=cyber')->json('data.*.title'),
            $this->suggest('cyber'),
            'dropdown and full results agree',
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

    public function test_card_shape(): void
    {
        $this->getJson('/api/v1/search/suggest?q=hades')
            ->assertJsonStructure(['data' => [['slug', 'title', 'platform' => ['slug', 'name'], 'region' => ['slug', 'name'], 'cover_url', 'min_price_cents']]]);
    }

    public function test_rejects_overlong_query(): void
    {
        $this->getJson('/api/v1/search/suggest?q='.str_repeat('a', 101))->assertJsonValidationErrors('q');
    }
}
