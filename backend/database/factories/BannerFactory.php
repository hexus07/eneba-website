<?php

namespace Database\Factories;

use App\Models\Banner;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Banner> */
class BannerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'title' => $this->faker->unique()->words(3, true),
            'subtitle' => $this->faker->sentence(),
            'image_url' => 'https://example.test/banner.jpg',
            'cta_label' => 'Buy now',
            'cta_url' => '/store',
            'position' => 0,
            'is_active' => true,
        ];
    }
}
