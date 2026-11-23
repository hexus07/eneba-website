<?php

namespace Tests\Feature;

use App\Models\HomeBlock;
use App\Services\Home\BlockProvider;
use App\Services\Home\BlockRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Layout + routing. Each provider's content is tested in HomeBlockProvidersTest. */
class HomeTest extends TestCase
{
    use RefreshDatabase;

    public function test_layout_lists_active_blocks_in_position_order_with_endpoints(): void
    {
        HomeBlock::factory()->create(['key' => 'second', 'type' => 'deals', 'title' => 'Top deals', 'position' => 20]);
        HomeBlock::factory()->create(['key' => 'first', 'type' => 'hero_banner', 'title' => 'Featured', 'position' => 10]);
        HomeBlock::factory()->create(['key' => 'off', 'type' => 'deals', 'position' => 5, 'is_active' => false]);

        $this->getJson('/api/v1/home')->assertOk()->assertExactJson(['data' => [
            ['key' => 'first', 'type' => 'hero_banner', 'title' => 'Featured', 'endpoint' => '/api/v1/home/blocks/first'],
            ['key' => 'second', 'type' => 'deals', 'title' => 'Top deals', 'endpoint' => '/api/v1/home/blocks/second'],
        ]]);
    }

    public function test_block_endpoint_returns_metadata_plus_provider_payload(): void
    {
        HomeBlock::factory()->create(['key' => 'custom', 'type' => 'test_type', 'title' => 'Custom', 'config' => ['n' => 3]]);
        $this->registerProvider('test_type', new class implements BlockProvider
        {
            public function provide(HomeBlock $block): array
            {
                return ['items' => range(1, $block->setting('n'))];
            }
        });

        $this->getJson('/api/v1/home/blocks/custom')->assertOk()->assertExactJson(['data' => [
            'key' => 'custom', 'type' => 'test_type', 'title' => 'Custom', 'items' => [1, 2, 3],
        ]]);
    }

    public function test_block_with_unregistered_type_is_hidden_from_layout_and_404(): void
    {
        HomeBlock::factory()->create(['key' => 'future', 'type' => 'not_deployed_yet']);
        HomeBlock::factory()->create(['key' => 'ok', 'type' => 'deals']);

        $this->getJson('/api/v1/home')->assertJsonCount(1, 'data')->assertJsonPath('data.0.key', 'ok');
        $this->getJson('/api/v1/home/blocks/future')->assertNotFound();
    }

    public function test_inactive_and_unknown_blocks_are_404(): void
    {
        HomeBlock::factory()->create(['key' => 'off', 'type' => 'deals', 'is_active' => false]);

        $this->getJson('/api/v1/home/blocks/off')->assertNotFound();
        $this->getJson('/api/v1/home/blocks/nope')->assertNotFound();
    }

    public function test_empty_layout(): void
    {
        $this->getJson('/api/v1/home')->assertOk()->assertExactJson(['data' => []]);
    }

    public function test_every_configured_type_resolves_to_a_provider(): void
    {
        $registry = app(BlockRegistry::class);

        foreach (array_keys(config('home.providers')) as $type) {
            $this->assertInstanceOf(BlockProvider::class, $registry->for($type), $type);
        }
    }

    private function registerProvider(string $type, BlockProvider $provider): void
    {
        $class = $provider::class;
        $this->app->instance($class, $provider);
        $this->app->singleton(BlockRegistry::class, fn ($app) => new BlockRegistry($app, config('home.providers') + [$type => $class]));
    }
}
