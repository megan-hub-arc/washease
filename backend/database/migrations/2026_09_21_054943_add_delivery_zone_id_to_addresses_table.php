<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('addresses', function (Blueprint $table) {
            $table->foreignId('delivery_zone_id')
                ->nullable()
                ->after('user_id')
                ->constrained('delivery_zones')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('addresses', function (Blueprint $table) {
            $table->dropForeign(['delivery_zone_id']);
            $table->dropColumn('delivery_zone_id');
        });
    }
};
