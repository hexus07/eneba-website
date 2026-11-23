<?php

namespace App\Console\Commands;

use App\Services\Catalog\OfferStats;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('catalog:sync-offer-stats')]
#[Description('Recompute products.min_price_cents and offers_count from active offers (run after bulk offer writes)')]
class SyncOfferStats extends Command
{
    public function handle(OfferStats $stats): int
    {
        $this->info($stats->refreshAll().' product(s) updated.');

        return self::SUCCESS;
    }
}
