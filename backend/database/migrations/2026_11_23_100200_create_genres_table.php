<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('genres', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('genre_product', function (Blueprint $table) {
            $table->foreignId('genre_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->primary(['genre_id', 'product_id']);
            // PK covers "products in genre X"; this covers "genres of product Y" (eager loading).
            $table->index('product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('genre_product');
        Schema::dropIfExists('genres');
    }
};
