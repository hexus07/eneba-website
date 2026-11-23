<?php

namespace Database\Factories;

use App\Models\Platform;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Platform> */
class PlatformFactory extends Factory
{
    public function definition(): array
    {
        $name = $this->faker->unique()->word().' '.$this->faker->unique()->numberBetween(1, 99999);

        return ['slug' => Str::slug($name), 'name' => ucfirst($name)];
    }
}
