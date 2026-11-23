<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        $orders = $request->user()->orders()
            ->with(['items.product', 'items.keys'])
            ->latest()
            ->paginate(10);

        return $this->noStore(OrderResource::collection($orders)->response());
    }

    public function show(Request $request, string $order): Response
    {
        $order = $request->user()->orders()->with(['items.product', 'items.keys'])->findOrFail($order);

        return $this->noStore((new OrderResource($order))->response());
    }

    /** Responses contain plaintext keys: keep them out of browser/proxy caches. */
    private function noStore(Response $response): Response
    {
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
