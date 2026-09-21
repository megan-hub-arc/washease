<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('address_id')
                ->constrained('addresses')
                ->restrictOnDelete();

            $table->string('order_number')->unique();

            $table->string('service_type')->default('Laundry');

            $table->decimal('weight', 8, 2)->nullable();

            $table->decimal('total_amount', 10, 2)->default(0);

            $table->string('status')->default('Pending');

            $table->text('notes')->nullable();

            $table->timestamp('requested_at')->nullable();

            $table->timestamp('scheduled_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
