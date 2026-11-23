<?php

namespace Tests\Feature;

use App\Models\Platform;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DidYouMeanTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $steam = Platform::factory()->create(['slug' => 'steam']);
        $psn = Platform::factory()->create(['slug' => 'psn']);

        Product::factory()->titled('Elden Ring')->create(['platform_id' => $psn->id, 'sales_count' => 10]);
        // Decoy: ties Elden Ring on word_similarity for "eldn rng" and is far more popular.
        Product::factory()->titled('The Elder Scrolls V: Skyrim Special Edition')->create(['platform_id' => $steam->id, 'sales_count' => 9000]);
        Product::factory()->titled('The Witcher 3: Wild Hunt')->create(['platform_id' => $steam->id]);
        Product::factory()->titled('Minecraft')->create(['platform_id' => $steam->id]);
    }

    private function meta(string $query): array
    {
        return $this->getJson('/api/v1/products?'.$query)->assertOk()->json('meta');
    }

    public function test_suggests_the_closest_title_when_a_typo_finds_nothing(): void
    {
        $meta = $this->meta('q='.urlencode('eldn rng'));

        $this->assertSame(0, $meta['total'], 'precondition: too many typos for the search itself');
        $this->assertSame('Elden Ring', $meta['did_you_mean'], 'not the more popular Elder Scrolls');
        $this->assertSame('The Witcher 3: Wild Hunt', $this->meta('q='.urlencode('witchr wld hnt'))['did_you_mean']);
    }

    public function test_the_suggestion_finds_results_when_followed(): void
    {
        $suggestion = $this->meta('q='.urlencode('mincraf jav'))['did_you_mean'];

        $this->assertSame('Minecraft', $suggestion);
        $this->assertGreaterThan(0, $this->meta('q='.urlencode($suggestion))['total']);
    }

    public function test_respects_the_other_active_filters(): void
    {
        // Elden Ring exists only on PSN: with platform=steam it must not be suggested.
        $this->assertNotSame('Elden Ring', $this->meta('q='.urlencode('eldn rng').'&platform=steam')['did_you_mean']);
        $this->assertSame('Elden Ring', $this->meta('q='.urlencode('eldn rng').'&platform=psn')['did_you_mean']);
    }

    public function test_no_suggestion_for_noise(): void
    {
        $this->assertNull($this->meta('q=zzqxv')['did_you_mean']);
    }

    public function test_null_when_there_are_results_or_no_query(): void
    {
        $this->assertNull($this->meta('q=minecraft')['did_you_mean']);
        $this->assertNull($this->meta('platform=steam')['did_you_mean']);
        $this->assertArrayHasKey('did_you_mean', $this->meta(''), 'always present in meta');
    }

    public function test_zero_results_from_filters_alone_suggest_nothing(): void
    {
        $this->assertNull($this->meta('price_min=999999')['did_you_mean']);
    }
}
