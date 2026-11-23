<?php

namespace Database\Factories;

use App\Models\Genre;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Genre> */
class GenreFactory extends Factory
{
    public function definition(): array
    {
        $name = ucfirst($this->faker->unique()->word()).' '.$this->faker->unique()->numberBetween(1, 99999);

        return ['slug' => Str::slug($name), 'name' => $name];
    }
}
