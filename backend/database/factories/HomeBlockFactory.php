<?php

namespace Database\Factories;

use App\Models\HomeBlock;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<HomeBlock> */
class HomeBlockFactory extends Factory
{
    public function definition(): array
    {
        return [
            'key' => $this->faker->unique()->slug(2),
            'type' => 'new_releases',
            'title' => ucfirst($this->faker->words(2, true)),
            'position' => $this->faker->numberBetween(1, 100),
            'config' => [],
            'is_active' => true,
        ];
    }
}
