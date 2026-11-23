<?php

namespace App\Services\Checkout;

use Illuminate\Http\JsonResponse;
use RuntimeException;

class OutOfStockException extends RuntimeException
{
    /** @param list<array{offer_id: int, reason: string, requested: int, available: int}> $problems */
    public function __construct(public readonly array $problems)
    {
        parent::__construct('Some items in your cart are no longer available.');
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage(), 'items' => $this->problems], 409);
    }
}
