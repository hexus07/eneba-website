<?php

namespace App\Observers;

use App\Models\Offer;
use App\Services\Catalog\OfferStats;

class OfferObserver
{
    /** Only these columns affect the product's min price / offer count. */
    private const TRACKED = ['price_cents', 'is_active', 'product_id'];

    public function __construct(private readonly OfferStats $stats) {}

    public function created(Offer $offer): void
    {
        $this->stats->refresh($offer->product_id);
    }

    public function updated(Offer $offer): void
    {
        // Not `saved` + wasRecentlyCreated: that flag stays true for the instance's lifetime,
        // so every later update on it would recompute.
        if (! $offer->wasChanged(self::TRACKED)) {
            return; // e.g. only original_price_cents changed
        }

        // `updated` fires before syncOriginal(), so the original product_id is still available:
        // moving an offer between products must refresh both.
        $this->stats->refresh($offer->product_id, (int) $offer->getOriginal('product_id'));
    }

    public function deleted(Offer $offer): void
    {
        $this->stats->refresh($offer->product_id);
    }
}
