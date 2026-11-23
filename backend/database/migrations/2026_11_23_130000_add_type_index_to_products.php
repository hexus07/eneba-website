<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // The store filters by type (Games / Software / eGift Cards nav links).
    public function up(): void
    {
        Schema::table('products', fn (Blueprint $table) => $table->index('type'));
    }

    public function down(): void
    {
        Schema::table('products', fn (Blueprint $table) => $table->dropIndex(['type']));
    }
};
