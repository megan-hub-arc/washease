<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'rider_id',
    'status',
    'capacity_kg',
    'max_orders',
    'total_load_kg',
    'scheduled_at',
    'started_at',
    'completed_at',
    'returned_at',
    'return_confirmed_by',
])]
class DeliveryRun extends Model
{
    public function rider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rider_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    protected function casts(): array
    {
        return [
            'capacity_kg' => 'decimal:2',
            'max_orders' => 'integer',
            'total_load_kg' => 'decimal:2',
            'scheduled_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'returned_at' => 'datetime',
        ];
    }
}
