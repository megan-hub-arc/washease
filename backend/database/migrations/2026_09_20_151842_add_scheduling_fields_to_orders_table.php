<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
        $table->integer('priority_score')->nullable()->after('status');
        $table->integer('delivery_sequence')->nullable()->after('priority_score');
        $table->string('delivery_status')->default('Unscheduled')->after('delivery_sequence');
    });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
        $table->dropColumn([
            'priority_score',
            'delivery_sequence',
            'delivery_status',
        ]);
    });
    }
};
