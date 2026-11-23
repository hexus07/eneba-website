<?php

namespace App\Services\Checkout;

use App\Enums\KeyStatus;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\ProductKey;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Key lifecycle for an order: available → reserved (checkout) → sold (payment), or back to
 * available (expiry, decline, cancel). The only place that changes product_keys.status.
 */
class KeyReservations
{
    /**
     * Reserve the order's keys. Call INSIDE the transaction that created the order: on shortage it
     * throws and the caller's rollback undoes every reservation (all-or-nothing).
     *
     * FOR UPDATE SKIP LOCKED: concurrent checkouts of the same offer each lock *different* rows
     * instead of queueing on the same ones, and a row locked by another transaction is invisible
     * here, so one key can never be reserved for two orders.
     */
    public function reserve(Order $order): void
    {
        foreach ($order->items as $item) {
            $keyIds = DB::table('product_keys')
                ->where('offer_id', $item->offer_id)
                ->where('status', KeyStatus::Available->value)
                ->orderBy('id')
                ->limit($item->quantity)
                // = lockForUpdate() + SKIP LOCKED. Laravel's builder has no skipLocked(); lock() takes the clause.
                ->lock('FOR UPDATE SKIP LOCKED')
                ->pluck('id');

            if ($keyIds->count() < $item->quantity) {
                throw new InsufficientStock($item->offer_id);
            }

            // Status guard + count check: a row that somehow stopped being available is never
            // overwritten; the mismatch turns into a loud failure and a rollback instead.
            $updated = ProductKey::query()->whereIn('id', $keyIds)->where('status', KeyStatus::Available)->update([
                'status' => KeyStatus::Reserved, 'order_item_id' => $item->id, 'reserved_until' => $order->expires_at, 'updated_at' => now(),
            ]);
            if ($updated !== $keyIds->count()) {
                throw new LogicException("Locked keys changed under us for order {$order->id}");
            }
        }
    }

    /** Reserved → sold for this order (inside the caller's transaction, order row locked). */
    public function sell(Order $order): void
    {
        $expected = $order->items->sum('quantity');
        $sold = ProductKey::query()
            ->whereIn('order_item_id', $order->items->pluck('id'))
            ->where('status', KeyStatus::Reserved)
            ->update(['status' => KeyStatus::Sold, 'reserved_until' => null, 'updated_at' => now()]);

        if ($sold !== $expected) {
            throw new LogicException("Order {$order->id} expected {$expected} reserved keys, found {$sold}");
        }
    }

    /** Put this order's reserved keys back on sale. Returns how many. */
    public function release(Order $order): int
    {
        return ProductKey::query()
            ->whereIn('order_item_id', $order->items->pluck('id'))
            ->where('status', KeyStatus::Reserved)
            ->update(['status' => KeyStatus::Available, 'order_item_id' => null, 'reserved_until' => null, 'updated_at' => now()]);
    }

    /**
     * If this pending order is past its reservation, mark it expired and release its keys.
     * Locks the order row, so it can't race a payment confirmation. Returns the fresh order.
     */
    public function expireIfStale(Order $order): Order
    {
        return DB::transaction(function () use ($order) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->with('items')->firstOrFail();
            if ($order->isPending() && $order->expires_at?->isPast()) {
                $this->release($order);
                $order->update(['status' => OrderStatus::Expired, 'failure_reason' => 'reservation_expired']);
            }

            return $order;
        });
    }

    /**
     * Expire every pending order past its reservation (the scheduled sweep, and run inline before a
     * checkout reserves keys, so stock never stays locked by abandoned orders even without cron).
     */
    public function expireStale(): int
    {
        $count = 0;
        Order::query()
            ->where('status', OrderStatus::Pending)
            ->where('expires_at', '<', now())
            ->orderBy('expires_at')
            ->limit(500)
            ->get()
            ->each(function (Order $order) use (&$count) {
                if ($this->expireIfStale($order)->status === OrderStatus::Expired) {
                    $count++;
                }
            });

        return $count;
    }
}
