<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Hero banners are our own gradient + text (no Eneba or publisher artwork): `theme` picks a
     * token-based gradient in the frontend; an image is optional.
     */
    public function up(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->string('image_url')->nullable()->change();
            $table->string('theme', 16)->default('violet')->after('subtitle');
        });
        DB::statement("ALTER TABLE banners ADD CONSTRAINT banners_theme_valid CHECK (theme IN ('violet', 'gold', 'teal'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE banners DROP CONSTRAINT banners_theme_valid');
        Schema::table('banners', function (Blueprint $table) {
            $table->dropColumn('theme');
            $table->string('image_url')->nullable(false)->change();
        });
    }
};
