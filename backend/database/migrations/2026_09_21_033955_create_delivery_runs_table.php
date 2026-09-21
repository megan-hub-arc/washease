<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_runs', function (Blueprint $table) {
            $table->id();

            $table->foreignId('rider_id')
                ->constrained('users')
                ->restrictOnDelete();

            $table->string('status')->default('Planned');

            $table->decimal('capacity_kg', 8, 2)->default(8);

            $table->decimal('total_load_kg', 8, 2)->default(0);

            $table->timestamp('scheduled_at')->nullable();

            $table->timestamp('started_at')->nullable();

            $table->timestamp('completed_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_runs');
    }
};
