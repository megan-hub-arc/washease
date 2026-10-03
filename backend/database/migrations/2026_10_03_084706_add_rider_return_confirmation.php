<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_runs', function (Blueprint $table) {
            $table->timestamp('returned_at')->nullable();
            $table->foreignId('return_confirmed_by')->nullable()->constrained('users')->nullOnDelete();
        });
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('rider_on_duty')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('delivery_runs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('return_confirmed_by');
            $table->dropColumn('returned_at');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('rider_on_duty');
        });
    }
};
