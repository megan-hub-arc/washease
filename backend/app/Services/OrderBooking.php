<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Service;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderBooking
{
    public static function rules(): array
    {
        return [
            'address_id' => ['required', 'integer', 'exists:addresses,id'],
            'service_id' => ['required', 'integer', 'exists:services,id'],
            'notes' => ['nullable', 'string', 'max:500'],
            'payment_preference' => ['required', 'in:Cash,GCash'],
        ] + self::timingRules();
    }

    public static function timingRules(): array
    {
        return [
            'pickup_requested_at' => ['nullable', 'date_format:Y-m-d\\TH:i:sP', 'after:now'],
            'delivery_requested_at' => ['nullable', 'date_format:Y-m-d\\TH:i:sP', 'after:now'],
        ];
    }

    public static function normalizedTimes(array $validated): array
    {
        $pickup = ! empty($validated['pickup_requested_at']) ? Carbon::parse($validated['pickup_requested_at']) : null;
        $delivery = ! empty($validated['delivery_requested_at']) ? Carbon::parse($validated['delivery_requested_at']) : null;
        if ($pickup && $delivery && $delivery->lessThanOrEqualTo($pickup)) {
            throw ValidationException::withMessages(['delivery_requested_at' => ['Requested delivery must be after requested pickup.']]);
        }

        return [
            'pickup_requested_at' => $pickup?->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s'),
            'delivery_requested_at' => $delivery?->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s'),
        ];
    }

    public function create(User $customer, array $validated): Order
    {
        $times = self::normalizedTimes($validated);

        return DB::transaction(function () use ($customer, $validated, $times) {
            $address = $customer->addresses()->whereNull('archived_at')->lockForUpdate()->findOrFail($validated['address_id']);
            $service = Service::whereKey($validated['service_id'])->where('is_active', true)->firstOrFail();

            return $customer->orders()->create([
                'address_id' => $address->id,
                'service_id' => $service->id,
                'order_number' => 'WS-'.strtoupper(Str::random(8)),
                'service_type' => $service->name,
                'weight' => null,
                'total_amount' => $service->pricing_type === 'fixed' ? $service->rate : 0,
                'status' => 'Pending',
                'notes' => $validated['notes'] ?? null,
                'payment_preference' => $validated['payment_preference'],
                'requested_at' => now(),
            ] + $times)->fresh();
        });
    }
}
