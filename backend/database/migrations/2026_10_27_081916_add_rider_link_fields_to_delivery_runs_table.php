<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_runs', function (Blueprint $table) {
            $table->string('rider_link_token_hash', 64)->nullable();
            $table->string('rider_link_session_hash', 64)->nullable();
            $table->timestamp('rider_link_expires_at')->nullable();
            $table->timestamp('rider_link_claimed_at')->nullable();
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('delivered_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('delivery_runs', function (Blueprint $table) {
            $table->dropColumn(['rider_link_token_hash', 'rider_link_session_hash', 'rider_link_expires_at', 'rider_link_claimed_at']);
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('delivered_at');
        });
    }
};
