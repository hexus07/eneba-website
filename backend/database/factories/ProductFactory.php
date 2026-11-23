<?php

namespace Database\Factories;

use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Product> */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        $title = Str::title($this->faker->unique()->words(3, true));

        return [
            'slug' => Str::slug($title).'-'.$this->faker->unique()->numberBetween(1, 999999),
            'title' => $title,
            'type' => 'game',
            'platform_id' => Platform::factory(),
            'region_id' => Region::factory(),
            'description' => $this->faker->paragraph(),
            'cover_url' => null,
            'developer' => $this->faker->company(),
            'publisher' => $this->faker->company(),
            'release_date' => $this->faker->dateTimeBetween('-10 years', 'now'),
            // Normally derived from offers by OfferObserver; set directly here so catalog tests
            // can control price without creating offers. Creating offers overwrites these.
            'min_price_cents' => $this->faker->numberBetween(199, 6999),
            'offers_count' => $this->faker->numberBetween(1, 6),
            'sales_count' => $this->faker->numberBetween(0, 5000),
        ];
    }

    /** No offers yet: stats as the observer would leave them. */
    public function withoutOffers(): static
    {
        return $this->state(['min_price_cents' => null, 'offers_count' => 0]);
    }

    public function titled(string $title): static
    {
        return $this->state(fn () => ['title' => $title, 'slug' => Str::slug($title).'-'.Str::random(6)]);
    }
}
