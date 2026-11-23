<?php

namespace App\Services\Payments;

use App\Models\Order;

interface PaymentGateway
{
    /** Stored on orders.payment_provider. */
    public function name(): string;

    /**
     * Start (or, for an order that already has one, resume) a payment for the order.
     * Must be idempotent per order: calling it twice must not create two charges.
     */
    public function createPayment(Order $order): PaymentSession;

    /** Refund a captured payment in full. Idempotent per order. */
    public function refund(Order $order): void;
}
