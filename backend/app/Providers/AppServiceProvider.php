<?php

namespace App\Providers;

use App\Services\Payments\FakeGateway;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\StripeGateway;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;
use Stripe\StripeClient;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Resolved per use (not a singleton) so the driver follows config at runtime (tests switch it).
        $this->app->bind(PaymentGateway::class, fn () => match (config('payments.driver')) {
            'fake' => new FakeGateway,
            'stripe' => new StripeGateway(
                new StripeClient((string) config('payments.stripe.secret')),
                config('payments.stripe.publishable_key'),
            ),
            default => throw new InvalidArgumentException('Unknown PAYMENT_DRIVER: '.config('payments.driver')),
        });
    }

    public function boot(): void
    {
        // Brute-force protection: per email+IP, so one attacker can't lock out a victim from everywhere.
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(5)
            ->by(strtolower((string) $request->input('email')).'|'.$request->ip()));
    }
}
