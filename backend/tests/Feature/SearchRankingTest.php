<?php

namespace Tests\Feature;

use App\Models\Platform;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Relevance when word_similarity ties: "eldn" scores 0.600 against Elden Ring, its DLC and The Elder
 * Scrolls alike, and popularity used to decide (Skyrim won). Both endpoints share the ranking.
 */
class SearchRankingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $steam = Platform::factory()->create(['slug' => 'steam']);
        // Decoy is the most popular title, as in the seed data.
        foreach ([
            ['The Elder Scrolls V: Skyrim Special Edition', 5812],
            ['Elden Ring', 4005],
            ['Elden Ring: Shadow of the Erdtree', 517],
            ["Marvel's Spider-Man Remastered", 3000],
            ["Marvel's Spider-Man: Miles Morales", 1000],
        ] as [$title, $sales]) {
            Product::factory()->titled($title)->create(['platform_id' => $steam->id, 'sales_count' => $sales]);
        }
    }

    public static function endpoints(): array
    {
        return ['catalog search' => ['/api/v1/products?q='], 'autocomplete' => ['/api/v1/search/suggest?q=']];
    }

    #[DataProvider('endpoints')]
    public function test_eldn_ranks_elden_ring_first_not_the_more_popular_elder_scrolls(string $endpoint): void
    {
        $titles = $this->getJson($endpoint.'eldn')->assertOk()->json('data.*.title');

        $this->assertSame('Elden Ring', $titles[0]);
        $this->assertLessThan(
            array_search('The Elder Scrolls V: Skyrim Special Edition', $titles, true),
            array_search('Elden Ring: Shadow of the Erdtree', $titles, true),
            'the Elden Ring DLC also ranks above the Skyrim decoy',
        );
    }

    #[DataProvider('endpoints')]
    public function test_prefix_matches_still_beat_similarity(string $endpoint): void
    {
        // "elder" is a whole-word prefix of Skyrim's title only.
        $this->assertSame('The Elder Scrolls V: Skyrim Special Edition', $this->getJson($endpoint.'elder')->json('data.0.title'));
    }
}
