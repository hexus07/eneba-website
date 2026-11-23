<?php

namespace Tests\Feature;

use App\Models\CartItem;
use App\Models\Offer;
use App\Models\Order;
use App\Models\ProductKey;
use App\Models\User;
use App\Services\Checkout\CheckoutService;
use App\Services\Checkout\OutOfStockException;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\BuildsOrders;
use Tests\Concerns\CommitsToDatabase;
use Tests\TestCase;

/**
 * Real concurrency against Postgres. Uses committed data (CommitsToDatabase) because other
 * connections/processes can't see data inside RefreshDatabase's uncommitted transaction.
 */
class KeyAssignmentConcurrencyTest extends TestCase
{
    use BuildsOrders, CommitsToDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['payments.driver' => 'fake']);
    }

    private function buyerWithCart(Offer $offer, int $quantity = 1): User
    {
        $buyer = User::factory()->create();
        CartItem::create(['user_id' => $buyer->id, 'offer_id' => $offer->id, 'quantity' => $quantity]);

        return $buyer;
    }

    public function test_keys_locked_by_another_transaction_are_skipped_not_waited_on_or_reused(): void
    {
        $offer = $this->offerWithKeys(3);
        [$k1, $k2, $k3] = $offer->keys()->orderBy('id')->pluck('id')->all();
        $alice = $this->buyerWithCart($offer);
        $bob = $this->buyerWithCart($offer);

        // Connection "other" plays a concurrent checkout that has locked k1 and k2 but not committed.
        config(['database.connections.other' => config('database.connections.pgsql')]);
        $other = DB::connection('other');
        $other->beginTransaction();
        $other->select('SELECT id FROM product_keys WHERE id IN (?, ?) FOR UPDATE', [$k1, $k2]);

        // Without SKIP LOCKED this would block on k1; lock_timeout turns waiting into a test failure.
        DB::statement("SET lock_timeout = '2s'");
        [$order] = app(CheckoutService::class)->checkout($alice, null);

        $this->assertSame([$k3], ProductKey::where('status', 'reserved')->where('order_item_id', $order->items()->sole()->id)->pluck('id')->all());

        // Only locked keys remain: Bob can't take them even though they're "available".
        try {
            app(CheckoutService::class)->checkout($bob, null);
            $this->fail('expected out of stock');
        } catch (OutOfStockException $e) {
            $this->assertSame($offer->id, $e->problems[0]['offer_id']);
        }
        $this->assertSame(1, Order::count(), 'no order for Bob');

        $other->rollBack();
        $this->assertSame([$k1, $k2], $offer->availableKeys()->orderBy('id')->pluck('id')->all());
    }

    public function test_parallel_checkouts_never_reserve_the_same_key_twice(): void
    {
        if (! function_exists('pcntl_fork')) {
            $this->markTestSkipped('pcntl not available');
        }

        $keys = 6;
        $offer = $this->offerWithKeys($keys);
        $buyers = collect(range(1, 10))->map(fn () => $this->buyerWithCart($offer));

        // Children must not share the parent's socket: drop it before forking, each child reconnects.
        DB::disconnect();
        $startAt = microtime(true) + 0.5; // crude barrier so all children hit the DB at the same moment
        $pids = [];

        foreach ($buyers as $buyer) {
            $pid = pcntl_fork();
            if ($pid === 0) {
                time_sleep_until($startAt);
                try {
                    app(CheckoutService::class)->checkout(User::findOrFail($buyer->id), null);
                } catch (OutOfStockException) {
                    // expected for the buyers who lose the race
                } catch (\Throwable $e) {
                    file_put_contents(storage_path("logs/race-{$buyer->id}.err"), (string) $e);
                }
                // SIGKILL: skip PHPUnit/Laravel shutdown handlers that would write to the parent's output.
                posix_kill(getmypid(), SIGKILL);
            }
            $pids[] = $pid;
        }
        foreach ($pids as $pid) {
            pcntl_waitpid($pid, $status);
        }

        $errors = glob(storage_path('logs/race-*.err'));
        $messages = array_map('file_get_contents', $errors);
        array_map('unlink', $errors);
        $this->assertSame([], $messages, 'no child failed unexpectedly');

        $this->assertSame($keys, Order::count(), 'exactly one order per key; the rest were told it is out of stock');
        $this->assertSame($keys, ProductKey::where('status', 'reserved')->count());
        $this->assertSame($keys, ProductKey::where('status', 'reserved')->distinct()->count('order_item_id'), 'one key per order item');
        $this->assertSame(0, $offer->availableKeys()->count());
    }
}
