<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sellers', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->decimal('rating', 3, 2)->default(0);   // 0.00 – 5.00
            $table->unsignedInteger('reviews_count')->default(0);
            $table->boolean('is_verified')->default(false);
            $table->timestamps();
        });

        DB::statement('ALTER TABLE sellers ADD CONSTRAINT sellers_rating_range CHECK (rating BETWEEN 0 AND 5)');
    }

    public function down(): void
    {
        Schema::dropIfExists('sellers');
    }
};
