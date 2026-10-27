<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('actor_user_id')->index();
            $table->string('actor_name');
            $table->string('actor_role', 20);
            $table->string('action', 40)->index();
            $table->string('subject_type', 20);
            $table->unsignedBigInteger('subject_id');
            $table->string('subject_label');
            $table->json('before_values');
            $table->json('after_values');
            $table->timestamp('created_at')->index();
            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
