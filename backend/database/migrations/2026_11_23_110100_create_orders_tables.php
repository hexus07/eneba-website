<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->uuid('id')->primary(); // non-enumerable in URLs
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('status', 16)->default('pending');
            $table->unsignedInteger('total_cents');
            $table->char('currency', 3)->default('EUR');
            $table->string('payment_provider', 16);
            $table->string('payment_ref')->nullable()->unique(); // Stripe PaymentIntent id / fake ref
            $table->string('idempotency_key', 100)->nullable();
            $table->string('failure_reason')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('fulfilled_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'idempotency_key']);
            $table->index(['user_id', 'created_at']); // order history
        });
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_status_valid CHECK (status IN ('pending', 'completed', 'failed', 'refunding', 'refunded'))");

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('offer_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            // Snapshot at purchase time: history must not change when a listing is edited.
            $table->string('product_title');
            $table->string('platform_name');
            $table->string('region_name');
            $table->string('seller_name');
            $table->unsignedInteger('unit_price_cents');
            $table->unsignedSmallInteger('quantity');
            $table->timestamps();

            $table->index('order_id');
        });

        Schema::table('product_keys', function (Blueprint $table) {
            $table->foreign('order_item_id')->references('id')->on('order_items')->restrictOnDelete();
        });

        // Webhook audit log + fast-path dedupe. Correctness does not depend on it: fulfillment is
        // idempotent on the order row itself (see OrderFulfiller).
        Schema::create('payment_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 16);
            $table->string('provider_event_id')->unique();
            $table->string('type');
            $table->jsonb('payload');
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_events');
        Schema::table('product_keys', fn (Blueprint $table) => $table->dropForeign(['order_item_id']));
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
