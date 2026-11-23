<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Homepage layout: which blocks, in which order, with which per-block settings.
        // Content comes from each block type's provider; the frontend only maps `type` to a component.
        Schema::create('home_blocks', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();        // URL id: /home/blocks/{key}
            $table->string('type', 32);             // provider lookup (config/home.php)
            $table->string('title');
            $table->unsignedSmallInteger('position');
            $table->jsonb('config')->default('{}'); // e.g. {"limit": 12, "days": 30}
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'position']);
        });

        Schema::create('banners', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->string('image_url');
            $table->string('cta_label');
            $table->string('cta_url');               // SPA-relative, e.g. /product/elden-ring-steam-global
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banners');
        Schema::dropIfExists('home_blocks');
    }
};
