<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'delivery_zone_id',
    'label',
    'address',
    'zone',
    'notes',
])]
class Address extends Model
{
    public function deliveryZone(): BelongsTo
    {
        return $this->belongsTo(DeliveryZone::class);
    }
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
