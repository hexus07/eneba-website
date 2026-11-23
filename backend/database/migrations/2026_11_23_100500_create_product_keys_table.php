<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_keys', function (Blueprint $table) {
            $table->id();
            // Sold keys must outlive their offer for order history → restrict, not cascade.
            $table->foreignId('offer_id')->constrained()->restrictOnDelete();
            $table->text('code');                     // ciphertext (Laravel `encrypted` cast, AES-256-CBC + MAC)
            $table->char('code_hash', 64)->unique();  // HMAC-SHA256 of normalized code: ciphertext is non-deterministic,
            // so this is what lets the DB reject duplicate keys.
            $table->string('status', 16)->default('available');
            $table->timestamp('reserved_until')->nullable();
            $table->unsignedBigInteger('order_item_id')->nullable(); // FK added with order_items in M7
            $table->timestamp('revealed_at')->nullable();
            $table->timestamps();

            // Key allocation ("next available key for offer X") and stock counts.
            $table->index(['offer_id', 'status']);
            $table->index('order_item_id');
        });

        DB::statement("ALTER TABLE product_keys ADD CONSTRAINT product_keys_status_valid CHECK (status IN ('available', 'reserved', 'sold'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('product_keys');
    }
};
