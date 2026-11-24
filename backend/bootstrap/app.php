<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // API-only: unauthenticated requests get a JSON 401, never a redirect to a login page
        // (without this, a request lacking `Accept: application/json` 500s on the missing `login` route).
        $middleware->redirectGuestsTo(fn () => null);

        // Behind Render's proxy: trust X-Forwarded-* so HTTPS is detected and rate limits key on the
        // real client IP (otherwise every visitor shares the proxy's IP and one login throttle).
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
