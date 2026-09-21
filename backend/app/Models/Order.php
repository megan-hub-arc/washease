<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'address_id',
    'order_number',
    'service_type',
    'weight',
    'total_amount',
    'status',
    'priority_score',
    'delivery_sequence',
    'delivery_status',
    'delivery_run_id',
    'notes',
    'requested_at',
    'scheduled_at',
    'payment_status',
    'payment_method',
    'paid_at',
])]

class Order extends Model
{
        public const STATUSES = [
        'Pending',
        'Confirmed',
        'Picked Up',
        'Processing',
        'Ready for Delivery',
        'Delivered',
    ];
    public function deliveryRun(): BelongsTo
    {
        return $this->belongsTo(DeliveryRun::class);
    }
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function address(): BelongsTo
    {
        return $this->belongsTo(Address::class);
    }

    protected function casts(): array
    {
        return [
            'weight' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'priority_score' => 'integer',
            'delivery_sequence' => 'integer',
            'requested_at' => 'datetime',
            'scheduled_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }
}
