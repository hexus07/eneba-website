<?php

namespace Tests\Feature;

use App\Models\Genre;
use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ProductIndexTest extends TestCase
{
    use RefreshDatabase;

    private Platform $steam;

    private Platform $psn;

    private Region $global;

    private Region $europe;

    protected function setUp(): void
    {
        parent::setUp();

        $this->steam = Platform::factory()->create(['slug' => 'steam', 'name' => 'Steam']);
        $this->psn = Platform::factory()->create(['slug' => 'psn', 'name' => 'PSN']);
        $this->global = Region::factory()->create(['slug' => 'global', 'name' => 'Global']);
        $this->europe = Region::factory()->create(['slug' => 'europe', 'name' => 'Europe']);
    }

    private function product(string $title, array $attrs = []): Product
    {
        return Product::factory()->titled($title)->create(array_merge([
            'platform_id' => $this->steam->id,
            'region_id' => $this->global->id,
        ], $attrs));
    }

    /** A realistic catalog of look-alike titles so fuzzy matching has something to get wrong. */
    private function seedCatalog(): void
    {
        foreach ([
            'Cyberpunk 2077', 'Cyber Shadow', 'Cyberpunk 2077: Phantom Liberty', 'Elden Ring',
            'Minecraft', 'Mine Mogul', 'The Witcher 3: Wild Hunt', 'Spider-Man: Miles Morales',
            "Assassin's Creed Valhalla", 'Red Dead Redemption 2', 'Grand Theft Auto V', 'Hades',
            'Hollow Knight', 'Stardew Valley', 'Baldur\'s Gate 3', 'Counter-Strike 2',
        ] as $i => $title) {
            $this->product($title, ['sales_count' => 100 - $i]);
        }
    }

    private function titles(string $query): array
    {
        return $this->getJson('/api/v1/products?'.$query)->assertOk()->json('data.*.title');
    }

    // ---- search -----------------------------------------------------------------------------

    #[DataProvider('typoQueries')]
    public function test_search_tolerates_typos(string $q, string $expectedFirst): void
    {
        $this->seedCatalog();

        $titles = $this->titles('q='.urlencode($q));

        $this->assertNotEmpty($titles, "No results for '$q'");
        $this->assertSame($expectedFirst, $titles[0], "Top result for '$q'");
    }

    public static function typoQueries(): array
    {
        return [
            'missing letter' => ['cyberpnk', 'Cyberpunk 2077'],
            'missing letter, other title' => ['minecaft', 'Minecraft'],
            'swapped letters' => ['witcehr', 'The Witcher 3: Wild Hunt'],
            'typo in two words' => ['eldn ring', 'Elden Ring'],
            'extra letter' => ['hollow knigght', 'Hollow Knight'],
            'wrong case + typo' => ['STARDEW VALEY', 'Stardew Valley'],
            'hyphen omitted' => ['spiderman', 'Spider-Man: Miles Morales'],
            'apostrophe omitted' => ['baldurs gate', 'Baldur\'s Gate 3'],
        ];
    }

    public function test_cyberpnk_ranks_base_game_above_dlc_and_lookalikes(): void
    {
        $this->seedCatalog();

        $titles = $this->titles('q=cyberpnk');

        $this->assertSame('Cyberpunk 2077', $titles[0]);
        $this->assertContains('Cyberpunk 2077: Phantom Liberty', $titles);
        $this->assertNotContains('Minecraft', $titles);
    }

    #[DataProvider('partialQueries')]
    public function test_search_matches_partial_names(string $q, string $expected): void
    {
        $this->seedCatalog();

        $this->assertContains($expected, $this->titles('q='.urlencode($q)));
    }

    public static function partialQueries(): array
    {
        return [
            'prefix' => ['cyber', 'Cyberpunk 2077'],
            'word prefix mid-title' => ['wild hu', 'The Witcher 3: Wild Hunt'],
            'two-letter prefix (no trigram)' => ['ha', 'Hades'],
            'substring' => ['dew', 'Stardew Valley'],
        ];
    }

    public function test_whole_word_match_ranks_above_longer_prefix_match(): void
    {
        $this->seedCatalog();

        // Both titles start with "mine"; "Mine Mogul" contains it as a whole word, so it wins
        // despite Minecraft's higher sales. Both outrank anything else.
        $titles = $this->titles('q=mine');

        $this->assertSame(['Mine Mogul', 'Minecraft'], array_slice($titles, 0, 2));
    }

    public function test_title_prefix_ranks_above_mid_title_word_prefix(): void
    {
        $this->product('Hunt: Showdown', ['sales_count' => 1]);
        $this->product('The Witcher 3: Wild Hunt', ['sales_count' => 1000]);

        $this->assertSame(['Hunt: Showdown', 'The Witcher 3: Wild Hunt'], $this->titles('q=hunt'));
    }

    public function test_unrelated_query_returns_nothing(): void
    {
        $this->seedCatalog();

        $this->assertSame([], $this->titles('q=zzqxv'));
    }

    #[DataProvider('symbolOnlyQueries')]
    public function test_symbol_only_query_matches_nothing_instead_of_everything(string $q): void
    {
        $this->seedCatalog();

        $this->assertSame([], $this->titles('q='.urlencode($q)));
    }

    public static function symbolOnlyQueries(): array
    {
        return ['LIKE wildcards' => ['%_%'], 'percent' => ['%'], 'punctuation' => ['!!!']];
    }

    public function test_search_combines_with_filters(): void
    {
        $this->product('Cyberpunk 2077', ['platform_id' => $this->steam->id]);
        $this->product('Cyberpunk 2077 PS', ['platform_id' => $this->psn->id]);

        $this->assertSame(['Cyberpunk 2077 PS'], $this->titles('q=cyberpnk&platform=psn'));
    }

    public function test_trigram_index_is_used_for_search(): void
    {
        $this->seedCatalog();

        DB::statement('SET LOCAL enable_seqscan = off'); // tiny table would otherwise always seq-scan
        $plan = collect(DB::select(
            "EXPLAIN SELECT id FROM products WHERE search_title ILIKE '%cyber%' OR 'cyberpnk' <% search_title"
        ))->pluck('QUERY PLAN')->implode("\n");

        $this->assertStringContainsString('products_search_title_trgm_idx', $plan);
    }

    // ---- filters ----------------------------------------------------------------------------

    public function test_filters_by_platform_and_region_accepting_array_or_csv(): void
    {
        $this->product('Steam Global');
        $this->product('Steam Europe', ['region_id' => $this->europe->id]);
        $this->product('PSN Global', ['platform_id' => $this->psn->id]);

        $this->assertEqualsCanonicalizing(['Steam Global', 'Steam Europe'], $this->titles('platform[]=steam'));
        $this->assertEqualsCanonicalizing(['Steam Global', 'PSN Global'], $this->titles('region=global'));
        $this->assertEqualsCanonicalizing(['Steam Global', 'Steam Europe', 'PSN Global'], $this->titles('platform=steam,psn'));
        $this->assertSame(['Steam Europe'], $this->titles('platform=steam&region=europe'));
    }

    public function test_filters_by_genre_any_of_the_given_slugs(): void
    {
        $rpg = Genre::factory()->create(['slug' => 'rpg']);
        $indie = Genre::factory()->create(['slug' => 'indie']);
        $this->product('RPG Only')->genres()->attach($rpg);
        $this->product('Indie Only')->genres()->attach($indie);
        $this->product('Both')->genres()->attach([$rpg->id, $indie->id]);
        $this->product('Neither');

        $this->assertEqualsCanonicalizing(['RPG Only', 'Both'], $this->titles('genre[]=rpg'));
        $this->assertEqualsCanonicalizing(['RPG Only', 'Indie Only', 'Both'], $this->titles('genre=rpg,indie'));
        $this->assertSame(['Both'], array_values(array_unique($this->titles('genre=rpg,indie&q=both'))), 'no duplicate rows from the join');
    }

    public function test_filters_by_type_and_combines_dimensions(): void
    {
        $this->product('Game Steam', ['type' => 'game']);
        $this->product('DLC Steam', ['type' => 'dlc']);
        $this->product('Card PSN', ['type' => 'gift_card', 'platform_id' => $this->psn->id]);

        $this->assertSame(['DLC Steam'], $this->titles('type=dlc'));
        $this->assertEqualsCanonicalizing(['Game Steam', 'DLC Steam'], $this->titles('type[]=game&type[]=dlc'));
        $this->assertSame([], $this->titles('type=gift_card&platform=steam'), 'dimensions are AND-ed');
    }

    public function test_genre_filter_does_not_duplicate_products_in_pagination(): void
    {
        $genres = Genre::factory()->count(3)->create();
        $this->product('Multi')->genres()->attach($genres->pluck('id'));

        $this->getJson('/api/v1/products?genre='.$genres->pluck('slug')->implode(','))
            ->assertJsonPath('meta.total', 1)->assertJsonCount(1, 'data');
    }

    public function test_filters_by_price_range_in_cents_inclusive(): void
    {
        $this->product('Cheap', ['min_price_cents' => 499]);
        $this->product('Mid', ['min_price_cents' => 1999]);
        $this->product('Pricey', ['min_price_cents' => 5999]);
        $this->product('No offers', ['min_price_cents' => null]);

        $this->assertEqualsCanonicalizing(['Mid', 'Pricey'], $this->titles('price_min=1999'));
        $this->assertEqualsCanonicalizing(['Cheap', 'Mid'], $this->titles('price_max=1999'));
        $this->assertSame(['Mid'], $this->titles('price_min=1000&price_max=2000'));
    }

    // ---- sorting ----------------------------------------------------------------------------

    public function test_sorts(): void
    {
        $this->product('A', ['min_price_cents' => 3000, 'release_date' => '2020-01-01', 'sales_count' => 10]);
        $this->product('B', ['min_price_cents' => 1000, 'release_date' => '2024-01-01', 'sales_count' => 5]);
        $this->product('C', ['min_price_cents' => 2000, 'release_date' => '2022-01-01', 'sales_count' => 50]);
        $this->product('D', ['min_price_cents' => null, 'release_date' => null, 'sales_count' => 0]);

        $this->assertSame(['B', 'C', 'A', 'D'], $this->titles('sort=price_asc'));
        $this->assertSame(['A', 'C', 'B', 'D'], $this->titles('sort=price_desc'));
        $this->assertSame(['B', 'C', 'A', 'D'], $this->titles('sort=newest'));
        $this->assertSame(['C', 'A', 'B', 'D'], $this->titles('sort=popular'));
        $this->assertSame(['C', 'A', 'B', 'D'], $this->titles(''), 'default sort without q is popular');
    }

    public function test_explicit_sort_overrides_relevance_when_searching(): void
    {
        $this->product('Cyberpunk 2077', ['min_price_cents' => 2999]);
        $this->product('Cyberpunk 2077: Phantom Liberty', ['min_price_cents' => 1999]);

        $this->assertSame(
            ['Cyberpunk 2077: Phantom Liberty', 'Cyberpunk 2077'],
            $this->titles('q=cyberpunk&sort=price_asc'),
        );
    }

    // ---- pagination & shape -----------------------------------------------------------------

    public function test_paginates_without_overlap_and_keeps_query_string(): void
    {
        foreach (range(1, 5) as $i) {
            $this->product("Game $i", ['sales_count' => 7]); // identical sort key → relies on id tie-breaker
        }

        $page1 = $this->getJson('/api/v1/products?per_page=2&page=1&platform=steam')->assertOk();
        $page3 = $this->getJson('/api/v1/products?per_page=2&page=3&platform=steam')->assertOk();
        $page2Titles = $this->titles('per_page=2&page=2&platform=steam');

        $page1->assertJsonPath('meta.total', 5)->assertJsonPath('meta.last_page', 3)->assertJsonCount(2, 'data');
        $page3->assertJsonCount(1, 'data');
        $this->assertCount(5, array_unique(array_merge($page1->json('data.*.title'), $page2Titles, $page3->json('data.*.title'))));
        $this->assertStringContainsString('platform=steam', $page1->json('links.next'));
    }

    public function test_response_shape(): void
    {
        $this->product('Elden Ring', ['min_price_cents' => 3499, 'release_date' => '2022-02-25']);

        $this->getJson('/api/v1/products')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [['id', 'slug', 'title', 'type', 'platform' => ['slug', 'name'], 'region' => ['slug', 'name'],
                    'cover_url', 'min_price_cents', 'currency', 'offers_count', 'release_date']],
                'links' => ['first', 'last', 'prev', 'next'],
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ])
            ->assertJsonPath('data.0.platform.slug', 'steam')
            ->assertJsonPath('data.0.min_price_cents', 3499)
            ->assertJsonPath('data.0.release_date', '2022-02-25');
    }

    #[DataProvider('invalidParams')]
    public function test_rejects_invalid_params(string $query, string $field): void
    {
        $this->getJson('/api/v1/products?'.$query)->assertUnprocessable()->assertJsonValidationErrors($field);
    }

    public static function invalidParams(): array
    {
        return [
            'unknown sort' => ['sort=cheapest', 'sort'],
            'negative price' => ['price_min=-1', 'price_min'],
            'max below min' => ['price_min=2000&price_max=1000', 'price_max'],
            'per_page too big' => ['per_page=500', 'per_page'],
            'q too long' => ['q='.str_repeat('a', 101), 'q'],
            'unknown type' => ['type=dlc,console', 'type.1'],
        ];
    }
}
