<?php

namespace App\Services\Payments;

use Illuminate\Http\JsonResponse;
use RuntimeException;

class PaymentGatewayException extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json(['message' => 'Payment provider is unavailable, please try again.'], 502);
    }
}
