<?php

namespace Database\Factories;

use App\Models\Seller;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Seller> */
class SellerFactory extends Factory
{
    public function definition(): array
    {
        $name = $this->faker->unique()->company();

        return [
            'slug' => Str::slug($name).'-'.$this->faker->unique()->numberBetween(1, 99999),
            'name' => $name,
            'rating' => $this->faker->randomFloat(2, 3.5, 5),
            'reviews_count' => $this->faker->numberBetween(10, 50000),
            'is_verified' => $this->faker->boolean(),
        ];
    }
}
