<?php

namespace App\Services\Checkout;

use RuntimeException;

/** Internal: thrown inside the fulfillment transaction to roll it back. */
class InsufficientStock extends RuntimeException
{
    public function __construct(public readonly int $offerId)
    {
        parent::__construct("Not enough available keys for offer {$offerId}");
    }
}
