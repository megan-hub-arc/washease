<?php

namespace App\Http\Controllers;

use App\Models\Address;
use App\Models\DeliveryZone;
use Illuminate\Http\Request;

class DeliveryZoneController extends Controller
{
    private function ensureStaffOrAdmin(Request $request): void
    {
        abort_unless(
            in_array($request->user()->role, ['staff', 'admin']),
            403
        );
    }

    public function index(Request $request)
    {
        $this->ensureStaffOrAdmin($request);

        return response()->json(
            DeliveryZone::orderBy('priority_order')->get()
        );
    }

    public function store(Request $request)
    {
        $this->ensureStaffOrAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'priority_order' => ['required', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $zone = DeliveryZone::create([
            'name' => $validated['name'],
            'priority_order' => $validated['priority_order'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'message' => 'Delivery zone created successfully.',
            'delivery_zone' => $zone,
        ], 201);
    }

    public function update(Request $request, DeliveryZone $deliveryZone)
    {
        $this->ensureStaffOrAdmin($request);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'priority_order' => ['sometimes', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $deliveryZone->update($validated);

        return response()->json([
            'message' => 'Delivery zone updated successfully.',
            'delivery_zone' => $deliveryZone->fresh(),
        ]);
    }

    public function assignAddress(Request $request, Address $address)
    {
        $this->ensureStaffOrAdmin($request);

        $validated = $request->validate([
            'delivery_zone_id' => [
                'required',
                'integer',
                'exists:delivery_zones,id',
            ],
        ]);

        $address->update([
            'delivery_zone_id' => $validated['delivery_zone_id'],
        ]);

        return response()->json([
            'message' => 'Address assigned to delivery zone successfully.',
            'address' => $address->fresh()->load('deliveryZone'),
        ]);
    }
}
