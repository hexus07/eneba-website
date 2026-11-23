<?php

namespace Tests\Feature;

use App\Models\Banner;
use App\Models\HomeBlock;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\HomeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HomeSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeded_homepage_renders_every_block_with_content(): void
    {
        $this->seed([CatalogSeeder::class, HomeSeeder::class]);

        $layout = $this->getJson('/api/v1/home')->assertOk()->json('data');
        $this->assertSame(array_column(HomeSeeder::BLOCKS, 'key'), array_column($layout, 'key'));
        $this->assertSame(count(config('home.providers')), count(array_unique(array_column($layout, 'type'))), 'every block type is used');

        foreach ($layout as $block) {
            $items = $this->getJson($block['endpoint'])->assertOk()->json('data.items');
            $this->assertNotEmpty($items, "{$block['key']} has content");
        }

        // Banners: our own gradient + text, CTAs into the store, no images.
        $this->assertSame(count(HomeSeeder::BANNERS), Banner::count());
        foreach (Banner::all() as $banner) {
            $this->assertContains($banner->theme, Banner::THEMES);
            $this->assertNull($banner->image_url, 'no third-party artwork');
            $this->assertStringStartsWith('/store', $banner->cta_url);
        }
    }

    public function test_is_idempotent(): void
    {
        $this->seed([CatalogSeeder::class, HomeSeeder::class, HomeSeeder::class]);

        $this->assertSame(count(HomeSeeder::BLOCKS), HomeBlock::count());
        $this->assertSame(count(HomeSeeder::BANNERS), Banner::count());
    }
}
