<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PaymentEvent;
use App\Services\Checkout\OrderFulfiller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Event;
use Stripe\Exception\SignatureVerificationException;
use Stripe\PaymentIntent;
use Stripe\Webhook;
use UnexpectedValueException;

class StripeWebhookController extends Controller
{
    public function __invoke(Request $request, OrderFulfiller $fulfiller): JsonResponse
    {
        try {
            $event = Webhook::constructEvent(
                $request->getContent(),
                (string) $request->header('Stripe-Signature'),
                (string) config('payments.stripe.webhook_secret'),
            );
        } catch (SignatureVerificationException|UnexpectedValueException) {
            return response()->json(['message' => 'Invalid signature or payload.'], 400);
        }

        if (PaymentEvent::query()->where('provider_event_id', $event->id)->whereNotNull('processed_at')->exists()) {
            return response()->json(['received' => true, 'duplicate' => true]);
        }

        $this->handle($event, $fulfiller);

        // Recorded only after successful handling: if handling throws, Stripe retries and we reprocess.
        PaymentEvent::query()->updateOrCreate(
            ['provider_event_id' => $event->id],
            ['provider' => 'stripe', 'type' => $event->type, 'payload' => $event->toArray(), 'processed_at' => now()],
        );

        return response()->json(['received' => true]);
    }

    private function handle(Event $event, OrderFulfiller $fulfiller): void
    {
        $intent = $event->data->object;
        if (! $intent instanceof PaymentIntent) {
            return;
        }

        $order = Order::query()->where('payment_ref', $intent->id)->first();
        if (! $order) {
            Log::warning('Stripe event for unknown PaymentIntent', ['event' => $event->id, 'intent' => $intent->id]);

            return;
        }

        match ($event->type) {
            'payment_intent.succeeded' => $this->succeeded($order, $intent, $fulfiller),
            'payment_intent.canceled' => $fulfiller->markFailed($order, 'payment_canceled'),
            // A failed attempt is not final: the intent returns to requires_payment_method and the
            // buyer can retry in Elements. Record why, keep the order pending.
            'payment_intent.payment_failed' => $order->isPending()
                ? $order->update(['failure_reason' => $intent->last_payment_error?->code ?? 'payment_failed'])
                : null,
            default => null,
        };
    }

    private function succeeded(Order $order, PaymentIntent $intent, OrderFulfiller $fulfiller): void
    {
        // Never trust that the charged amount matches the order: the amount is what we deliver against.
        if ($intent->amount_received !== $order->total_cents || strtoupper($intent->currency) !== $order->currency) {
            Log::critical('Stripe amount mismatch; not fulfilling', [
                'order_id' => $order->id, 'expected' => $order->total_cents, 'received' => $intent->amount_received, 'currency' => $intent->currency,
            ]);
            $fulfiller->markFailed($order, 'amount_mismatch');

            return;
        }

        $fulfiller->markPaid($order);
    }
}
