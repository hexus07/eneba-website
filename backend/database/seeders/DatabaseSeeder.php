<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    // NB: no WithoutModelEvents — the catalog relies on model events (Product search_title, OfferObserver).
    public function run(): void
    {
        User::query()->firstOrCreate(
            ['email' => 'demo@example.com'],
            ['name' => 'Demo User', 'password' => 'password'],
        );

        $this->call([CatalogSeeder::class, HomeSeeder::class]);
    }
}
