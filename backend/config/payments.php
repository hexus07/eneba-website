<?php

return [
    // fake: in-app approve/decline (local dev, tests, demo without a Stripe account)
    // stripe: Stripe PaymentIntents in TEST mode + signed webhook
    'driver' => env('PAYMENT_DRIVER', 'fake'),

    'currency' => 'EUR',

    'stripe' => [
        'secret' => env('STRIPE_SECRET'),
        'publishable_key' => env('STRIPE_PUBLISHABLE_KEY'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    ],
];
