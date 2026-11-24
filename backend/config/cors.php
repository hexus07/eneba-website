<?php

/*
 * Only the frontend may call the API from a browser. Auth is a bearer token (no cookies), so
 * credentials are off. Origins come from CORS_ALLOWED_ORIGINS (comma-separated, exact, e.g.
 * "https://gamekeys.vercel.app"); CORS_ALLOWED_ORIGIN_PATTERNS takes regexes, e.g. for Vercel
 * preview deployments: "#^https://gamekeys-[a-z0-9-]+-hexus07\.vercel\.app$#".
 */
$list = fn (string $key, string $default = '') => array_values(array_filter(array_map('trim', explode(',', (string) env($key, $default)))));

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => $list('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:4173'),
    'allowed_origins_patterns' => $list('CORS_ALLOWED_ORIGIN_PATTERNS'),
    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'Idempotency-Key'],
    'exposed_headers' => [],
    'max_age' => 600,
    'supports_credentials' => false,
];
