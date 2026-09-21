<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'name',
    'priority_order',
    'is_active',
])]
class DeliveryZone extends Model
{
    public function addresses(): HasMany
    {
        return $this->hasMany(Address::class);
    }

    protected function casts(): array
    {
        return [
            'priority_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
