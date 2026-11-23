<?php

namespace App\Services\Payments;

final readonly class PaymentSession
{
    /**
     * @param  string  $reference  provider payment id (stored as orders.payment_ref)
     * @param  array<string, mixed>  $client  what the SPA needs to complete payment (no secrets beyond client_secret)
     */
    public function __construct(
        public string $provider,
        public string $reference,
        public array $client,
    ) {}

    public function toArray(): array
    {
        return ['provider' => $this->provider] + $this->client;
    }
}
