<?php

namespace Database\Seeders;

use App\Models\Genre;
use App\Models\Offer;
use App\Models\Platform;
use App\Models\Product;
use App\Models\ProductKey;
use App\Models\Region;
use App\Models\Seller;
use App\Services\Catalog\OfferStats;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Random\Engine\Mt19937;
use Random\Randomizer;

/**
 * Seeds the catalog from database/seeders/data/catalog.php (PLAN.md §3):
 * titles × platform × region variants, 2–6 seller offers each, 3–20 fake keys per offer.
 *
 * Deterministic: a fixed RNG seed gives the same catalog on every machine, so screenshots,
 * demo links and manual test notes stay valid across `migrate:fresh --seed`.
 */
class CatalogSeeder extends Seeder
{
    public const SEED = 2077;

    private Randomizer $rng;

    public function run(OfferStats $stats): void
    {
        if (Product::query()->exists()) {
            $this->command?->warn('Catalog already seeded; skipping (use migrate:fresh --seed to reseed).');

            return;
        }

        $this->rng = new Randomizer(new Mt19937(self::SEED));
        $data = require __DIR__.'/data/catalog.php';

        DB::transaction(function () use ($data, $stats) {
            $platforms = $this->lookup(Platform::class, $data['platforms']);
            $regions = $this->lookup(Region::class, $data['regions']);
            $genres = $this->lookup(Genre::class, $data['genres']);
            $sellers = $this->seedSellers($data['sellers']);

            $titleCount = count($data['titles']);
            foreach ($data['titles'] as $rank => $row) {
                [$title, $appId, $developer, $publisher, $released, $msrp, $genreSlugs, $platformSlugs] = $row;
                $type = $row[8] ?? 'game';
                // Popularity decays with list position; ±50% noise so neighbours shuffle a bit.
                $popularity = exp(-$rank / ($titleCount / 3)) * $this->float(0.5, 1.5);

                foreach ($platformSlugs as $platformSlug) {
                    foreach ($this->pickRegions($data['platform_regions'][$platformSlug]) as $regionSlug) {
                        $product = Product::create([
                            'slug' => Str::slug("$title $platformSlug $regionSlug"),
                            'title' => $title,
                            'type' => $type,
                            'platform_id' => $platforms[$platformSlug],
                            'region_id' => $regions[$regionSlug],
                            'description' => $this->description($title, $type, $developer, $data['platforms'][$platformSlug], $data['regions'][$regionSlug], $genreSlugs, $data['genres']),
                            // Portrait capsule (600×900) to match the 4:5 product cards. The frontend
                            // falls back to the landscape header.jpg, then a placeholder, if it 404s.
                            'cover_url' => $appId ? self::steamImage($appId, 'library_600x900.jpg') : null,
                            'developer' => $developer,
                            'publisher' => $publisher,
                            'release_date' => $released,
                            'sales_count' => (int) round(8000 * $popularity * ($regionSlug === 'global' ? 1.0 : 0.4) * $this->float(0.6, 1.4)),
                        ]);
                        $product->genres()->attach(array_map(fn ($g) => $genres[$g], $genreSlugs));

                        $basePrice = $msrp * $data['region_price_factor'][$regionSlug];
                        $this->seedOffers($product, $type, $basePrice, $msrp, $sellers);
                    }
                }
            }

            // The observer already maintained stats offer-by-offer; this is a cheap safety net
            // (and the path any future bulk-insert seeding would rely on).
            $stats->refreshAll();
        });

        $this->command?->info(sprintf(
            'Seeded %d products, %d offers, %d keys.',
            Product::count(), Offer::count(), ProductKey::count(),
        ));
    }

    public static function steamImage(int $appId, string $file): string
    {
        return "https://cdn.akamai.steamstatic.com/steam/apps/{$appId}/{$file}";
    }

    /** @return array<string, int> slug => id */
    private function lookup(string $model, array $rows): array
    {
        $now = Carbon::now();
        $model::query()->upsert(
            collect($rows)->map(fn ($name, $slug) => ['slug' => $slug, 'name' => $name, 'created_at' => $now, 'updated_at' => $now])->values()->all(),
            ['slug'],
            ['name', 'updated_at'],
        );

        return $model::query()->pluck('id', 'slug')->all();
    }

    /** @return list<int> seller ids */
    private function seedSellers(array $rows): array
    {
        return collect($rows)->map(fn ($s) => Seller::create([
            'slug' => Str::slug($s[0]),
            'name' => $s[0],
            'rating' => $s[1],
            'reviews_count' => $s[2],
            'is_verified' => $s[3],
        ])->id)->all();
    }

    /** 1–2 distinct regions, weighted (steam occasionally gets 3). */
    private function pickRegions(array $weights): array
    {
        $count = min(count($weights), $this->int(1, 100) <= 70 ? 1 : ($this->int(1, 100) <= 85 ? 2 : 3));
        $picked = [];
        while (count($picked) < $count) {
            $picked[$this->weighted(array_diff_key($weights, $picked))] = true;
        }

        return array_keys($picked);
    }

    private function seedOffers(Product $product, string $type, float $basePrice, int $msrp, array $sellerIds): void
    {
        $sellerOrder = $this->rng->shuffleArray($sellerIds);
        $isCard = in_array($type, ['gift_card', 'subscription'], true);

        foreach (array_slice($sellerOrder, 0, $this->int(2, 6)) as $sellerId) {
            // Games: grey-market discount off MSRP. Cards: small premium over face value.
            $price = $isCard ? $basePrice * $this->float(1.01, 1.12) : $basePrice * $this->float(0.32, 0.95);
            $price = max(99, (int) round($price));

            $offer = Offer::create([
                'product_id' => $product->id,
                'seller_id' => $sellerId,
                'price_cents' => $price,
                // Show a "was" price (discount badge) on ~60% of discounted game offers.
                'original_price_cents' => ! $isCard && $price < $msrp * 0.9 && $this->int(1, 100) <= 60 ? $msrp : null,
                'is_active' => $this->int(1, 100) > 6, // a few paused listings, to exercise "active only"
            ]);

            ProductKey::query()->insert(array_map(
                fn () => ProductKey::rowFor($offer->id, $this->fakeKey()) + ['created_at' => now(), 'updated_at' => now()],
                range(1, $this->int(3, 20)),
            ));
        }
    }

    private function description(string $title, string $type, string $developer, string $platform, string $region, array $genreSlugs, array $genreNames): string
    {
        $genres = implode(', ', array_map(fn ($g) => $genreNames[$g], $genreSlugs));

        return match ($type) {
            'gift_card' => "$title — digital code for $platform. Redeem in your $platform account to add funds. Region: $region.",
            'subscription' => "$title — subscription code for $platform. Activates instantly on redemption. Region: $region.",
            'dlc' => "$title is downloadable content by $developer ($genres). Requires the base game. Activate on $platform. Region: $region.",
            default => "$title is a $genres game by $developer. This is a digital key: activate it on $platform to download and play. Region: $region.",
        };
    }

    /** XXXXX-XXXXX-XXXXX, no ambiguous characters (0/O, 1/I). */
    private function fakeKey(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

        return implode('-', array_map(fn () => $this->rng->getBytesFromString($alphabet, 5), range(1, 3)));
    }

    private function weighted(array $weights): string
    {
        $roll = $this->int(1, array_sum($weights));
        foreach ($weights as $key => $weight) {
            if (($roll -= $weight) <= 0) {
                return $key;
            }
        }

        return array_key_last($weights);
    }

    private function int(int $min, int $max): int
    {
        return $this->rng->getInt($min, $max);
    }

    private function float(float $min, float $max): float
    {
        return $this->rng->getFloat($min, $max);
    }
}
