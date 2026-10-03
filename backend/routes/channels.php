<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('customers.{id}', fn (User $user, string $id) => $user->role === 'customer' && (string) $user->id === $id, ['guards' => ['sanctum']]);
