<?php

namespace Tests\Feature;

use App\Models\Genre;
use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductFacetsTest extends TestCase
{
    use RefreshDatabase;

    private Platform $steam;

    private Platform $psn;

    private Region $global;

    private Region $europe;

    private Genre $rpg;

    private Genre $indie;

    protected function setUp(): void
    {
        parent::setUp();
        $this->steam = Platform::factory()->create(['slug' => 'steam', 'name' => 'Steam']);
        $this->psn = Platform::factory()->create(['slug' => 'psn', 'name' => 'PSN']);
        Platform::factory()->create(['slug' => 'gog', 'name' => 'GOG']); // no products
        $this->global = Region::factory()->create(['slug' => 'global', 'name' => 'Global']);
        $this->europe = Region::factory()->create(['slug' => 'europe', 'name' => 'Europe']);
        $this->rpg = Genre::factory()->create(['slug' => 'rpg', 'name' => 'RPG']);
        $this->indie = Genre::factory()->create(['slug' => 'indie', 'name' => 'Indie']);

        // steam/global ×2 (rpg, rpg+indie), steam/europe ×1 (indie), psn/global ×1 (rpg)
        $this->make('Elden Ring', $this->steam, $this->global, [$this->rpg], 3000);
        $this->make('Hades', $this->steam, $this->global, [$this->rpg, $this->indie], 1500);
        $this->make('Celeste', $this->steam, $this->europe, [$this->indie], 900);
        $this->make('Elden Ring PS', $this->psn, $this->global, [$this->rpg], 3500);
    }

    private function make(string $title, Platform $platform, Region $region, array $genres, int $price): void
    {
        Product::factory()->titled($title)
            ->create(['platform_id' => $platform->id, 'region_id' => $region->id, 'min_price_cents' => $price])
            ->genres()->attach(collect($genres)->pluck('id'));
    }

    /** @return array<string, int> slug => count */
    private function counts(string $query, string $dimension): array
    {
        return collect($this->getJson('/api/v1/products?'.$query)->assertOk()->json("meta.facets.$dimension"))
            ->pluck('count', 'slug')->all();
    }

    public function test_counts_per_platform_region_and_genre_without_filters(): void
    {
        $this->assertSame(['steam' => 3, 'psn' => 1], $this->counts('', 'platform'), 'sorted by count; empty platforms left out');
        $this->assertSame(['global' => 3, 'europe' => 1], $this->counts('', 'region'));
        $this->assertSame(['rpg' => 3, 'indie' => 2], $this->counts('', 'genre'));
    }

    public function test_a_dimension_ignores_its_own_filter_but_applies_the_others(): void
    {
        // Selecting steam must not zero out psn (it shows what adding psn would give)…
        $this->assertSame(['steam' => 3, 'psn' => 1], $this->counts('platform=steam', 'platform'));
        // …while the other dimensions are counted within steam only.
        $this->assertSame(['global' => 2, 'europe' => 1], $this->counts('platform=steam', 'region'));
        $this->assertSame(['indie' => 2, 'rpg' => 2], $this->counts('platform=steam', 'genre'), 'ties sorted by name');
    }

    public function test_facets_follow_the_search_query(): void
    {
        $this->assertSame(['psn' => 1, 'steam' => 1], $this->counts('q=eldn', 'platform'));
        $this->assertSame(['rpg' => 2], $this->counts('q=eldn', 'genre'));
    }

    public function test_marks_selected_options_and_keeps_them_listed_at_zero(): void
    {
        $facet = collect($this->getJson('/api/v1/products?region=europe&platform=psn')->json('meta.facets.region'))->keyBy('slug');

        $this->assertSame(['slug' => 'europe', 'name' => 'Europe', 'count' => 0, 'selected' => true], $facet['europe']);
        $this->assertSame(['slug' => 'global', 'name' => 'Global', 'count' => 1, 'selected' => false], $facet['global']);
    }

    public function test_price_range_covers_current_results_but_ignores_the_price_filter(): void
    {
        $this->getJson('/api/v1/products?platform=steam&price_max=1000')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.price_range', ['min' => 900, 'max' => 3000]);

        $this->getJson('/api/v1/products?q=zzqxv')->assertJsonPath('meta.price_range', ['min' => null, 'max' => null]);
    }

    public function test_pagination_meta_is_kept_next_to_facets(): void
    {
        $this->getJson('/api/v1/products?per_page=2')
            ->assertJsonPath('meta.total', 4)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonStructure(['meta' => ['current_page', 'per_page', 'facets' => ['platform', 'region', 'genre'], 'price_range']]);
    }
}
