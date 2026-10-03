<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_runs', function (Blueprint $table) {
            $table->unsignedInteger('max_orders')->default(20);
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_preference')->nullable();
        });
        Schema::create('delivery_assignment_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_run_id')->nullable()->constrained('delivery_runs');
            $table->foreignId('to_run_id')->constrained('delivery_runs');
            $table->foreignId('staff_id')->constrained('users');
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_assignment_events');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('payment_preference');
        });
        Schema::table('delivery_runs', function (Blueprint $table) {
            $table->dropColumn('max_orders');
        });
    }
};
