<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CartController;
use App\Http\Controllers\Api\V1\CheckoutController;
use App\Http\Controllers\Api\V1\FakePaymentController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\StripeWebhookController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{slug}', [ProductController::class, 'show'])->where('slug', '[a-z0-9-]+');

    Route::middleware('throttle:auth')->group(function () {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::post('/auth/login', [AuthController::class, 'login']);
    });

    // Signature-verified, so no auth middleware.
    Route::post('/payments/stripe/webhook', StripeWebhookController::class);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        Route::get('/cart', [CartController::class, 'show']);
        Route::post('/cart/items', [CartController::class, 'store']);
        Route::patch('/cart/items/{cartItem}', [CartController::class, 'update'])->whereNumber('cartItem');
        Route::delete('/cart/items/{cartItem}', [CartController::class, 'destroy'])->whereNumber('cartItem');
        Route::post('/cart/merge', [CartController::class, 'merge']);

        Route::post('/checkout', [CheckoutController::class, 'store']);

        // whereUuid: a malformed id is a 404 here, not a Postgres "invalid uuid" 500.
        Route::get('/orders', [OrderController::class, 'index']);
        Route::get('/orders/{order}', [OrderController::class, 'show'])->whereUuid('order');
        Route::post('/payments/fake/{order}/confirm', [FakePaymentController::class, 'confirm'])->whereUuid('order');
    });
});
