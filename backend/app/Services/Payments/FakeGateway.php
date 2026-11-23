<?php

namespace App\Services\Payments;

use App\Models\Order;

/**
 * Simulated payments: the SPA shows Approve / Decline and calls
 * POST /api/v1/checkout/{order}/confirm. No money, no network.
 */
class FakeGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'fake';
    }

    public function createPayment(Order $order): PaymentSession
    {
        return new PaymentSession('fake', 'fake_'.$order->id, [
            'confirm_url' => url("/api/v1/checkout/{$order->id}/confirm"),
        ]);
    }

    public function refund(Order $order): void
    {
        // Nothing was charged.
    }
}
