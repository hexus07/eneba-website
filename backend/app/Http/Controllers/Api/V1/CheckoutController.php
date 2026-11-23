<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Services\Checkout\CheckoutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CheckoutController extends Controller
{
    public function store(Request $request, CheckoutService $checkout): JsonResponse
    {
        $key = $request->header('Idempotency-Key');
        if ($key !== null && (strlen($key) > 100 || $key === '')) {
            throw ValidationException::withMessages(['idempotency_key' => 'Idempotency-Key must be 1–100 characters.']);
        }

        [$order, $payment] = $checkout->checkout($request->user(), $key);

        return response()->json([
            'data' => new OrderResource($order->load('items.product')),
            'payment' => $payment?->toArray(),
        ], $order->wasRecentlyCreated ? 201 : 200);
    }
}
