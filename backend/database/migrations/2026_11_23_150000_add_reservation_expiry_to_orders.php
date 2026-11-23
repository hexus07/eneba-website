<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Keys are reserved at checkout and held until `expires_at`; unpaid orders then become
     * `expired` and their keys go back on sale.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('expires_at')->nullable()->after('failure_reason');
            $table->index(['status', 'expires_at']); // the expiry sweep: pending orders past expires_at
        });
        DB::statement('ALTER TABLE orders DROP CONSTRAINT orders_status_valid');
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_status_valid CHECK (status IN ('pending', 'completed', 'failed', 'expired', 'refunding', 'refunded'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE orders DROP CONSTRAINT orders_status_valid');
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_status_valid CHECK (status IN ('pending', 'completed', 'failed', 'refunding', 'refunded'))");
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['status', 'expires_at']);
            $table->dropColumn('expires_at');
        });
    }
};
