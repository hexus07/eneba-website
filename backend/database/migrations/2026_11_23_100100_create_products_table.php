<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // pg_trgm is a "trusted" extension (PG13+), so it can be created without superuser (also on Neon).
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            // Lowercased, accent-free, punctuation-free copy of title; maintained by the Product model.
            $table->string('search_title');
            $table->string('type')->default('game'); // game | dlc | gift_card | subscription | software
            $table->foreignId('platform_id')->constrained()->restrictOnDelete();
            $table->foreignId('region_id')->constrained()->restrictOnDelete();
            $table->text('description')->nullable();
            $table->string('cover_url')->nullable();
            $table->string('developer')->nullable();
            $table->string('publisher')->nullable();
            $table->date('release_date')->nullable();
            // Denormalized from offers (cheapest active offer) so price filter/sort is indexable.
            $table->unsignedInteger('min_price_cents')->nullable();
            $table->unsignedInteger('offers_count')->default(0);
            $table->unsignedInteger('sales_count')->default(0);
            $table->timestamps();

            $table->index('platform_id');
            $table->index('region_id');
            $table->index('min_price_cents');
            $table->index('release_date');
            $table->index('sales_count');
        });

        // Trigram GIN index: serves `q <% search_title` (word similarity, typo tolerance)
        // and `search_title ILIKE '%…%'` (prefix / partial match) from one index.
        // fastupdate = off: otherwise bulk inserts (seeding, imports) sit in GIN's unsorted pending list
        // until autovacuum runs, and the planner falls back to a seq scan (measured: 90 ms vs 0.04 ms at
        // 50k rows). The catalog is read-heavy, so paying index-merge cost on write is the right trade.
        DB::statement('CREATE INDEX products_search_title_trgm_idx ON products USING gin (search_title gin_trgm_ops) WITH (fastupdate = off)');
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
