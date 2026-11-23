<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Services\Checkout\OrderFulfiller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Simulated payment confirmation. Only routed when PAYMENT_DRIVER=fake. */
class FakePaymentController extends Controller
{
    public function confirm(Request $request, string $order): OrderResource
    {
        abort_unless(config('payments.driver') === 'fake', 404);

        $data = $request->validate(['outcome' => ['required', Rule::in(['succeed', 'fail'])]]);
        $order = $request->user()->orders()->findOrFail($order);
        // Resolved only after the driver check: with the stripe driver, building the gateway needs keys.
        $fulfiller = app(OrderFulfiller::class);

        $order = $data['outcome'] === 'succeed'
            ? $fulfiller->markPaid($order)
            : $fulfiller->markFailed($order, 'card_declined');

        return new OrderResource($order->load(['items.product', 'items.keys']));
    }
}
