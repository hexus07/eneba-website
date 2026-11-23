<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('price_cents');
            // Reference "was" price for discount badges; null = no discount shown.
            $table->unsignedInteger('original_price_cents')->nullable();
            $table->char('currency', 3)->default('EUR');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // One listing per seller per product; a seller changes price instead of adding a second offer.
            $table->unique(['product_id', 'seller_id']);
            // Product page ("active offers, cheapest first") and the min-price aggregate in OfferStats.
            $table->index(['product_id', 'is_active', 'price_cents']);
            $table->index('seller_id');
        });

        DB::statement('ALTER TABLE offers ADD CONSTRAINT offers_price_positive CHECK (price_cents > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('offers');
    }
};
