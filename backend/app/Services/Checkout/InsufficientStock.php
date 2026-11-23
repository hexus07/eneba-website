<?php

namespace App\Services\Checkout;

use RuntimeException;

/** Internal: thrown inside the checkout transaction when keys run out, to roll the order back. */
class InsufficientStock extends RuntimeException
{
    public function __construct(public readonly int $offerId)
    {
        parent::__construct("Not enough available keys for offer {$offerId}");
    }
}
