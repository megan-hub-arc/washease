<?php

namespace App\Http\Controllers;

use App\Models\Address;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AddressController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(
            $request->user()->addresses()->whereNull('archived_at')->latest()->get()
        );
    }

    public function staffIndex(Request $request)
    {
        abort_unless(
            in_array($request->user()->role, ['staff', 'admin']),
            403
        );

        return response()->json(
            Address::with(['user', 'deliveryZone'])
                ->where(fn ($query) => $query->whereNull('archived_at')
                    ->orWhereHas('orders', fn ($orders) => $orders->where('status', '!=', 'Delivered')))
                ->latest()
                ->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:50'],
            'address' => ['required', 'string', 'max:500'],
            'zone' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $address = $request->user()->addresses()->create([
            'label' => $validated['label'] ?? 'Home',
            'address' => $validated['address'],
            'zone' => $validated['zone'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json([
            'message' => 'Address created successfully.',
            'address' => $address,
        ], 201);
    }

    public function show(Request $request, Address $address)
    {
        abort_unless(
            $address->user_id === $request->user()->id && $address->archived_at === null,
            404
        );

        return response()->json($address);
    }

    public function update(Request $request, Address $address)
    {
        abort_unless(
            $address->user_id === $request->user()->id && $address->archived_at === null,
            404
        );

        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:50'],
            'address' => ['required', 'string', 'max:500'],
            'zone' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $address = DB::transaction(function () use ($address, $validated) {
            $current = Address::whereKey($address->id)->lockForUpdate()->firstOrFail();
            abort_unless($current->archived_at === null, 404);
            $locationChanged = $current->address !== $validated['address']
                || $current->zone !== ($validated['zone'] ?? null);
            $values = array_merge($validated, [
                'user_id' => $current->user_id,
                'delivery_zone_id' => $locationChanged ? null : $current->delivery_zone_id,
            ]);
            // Keep the original address and assigned zone for every existing booking.
            if (Order::where('address_id', $current->id)->exists()) {
                $replacement = Address::create($values);
                $current->update(['archived_at' => now()]);

                return $replacement;
            }
            $current->update($values);

            return $current;
        });

        return response()->json([
            'message' => 'Address updated successfully.',
            'address' => $address,
        ]);
    }

    public function destroy(Request $request, Address $address)
    {
        abort_unless(
            $address->user_id === $request->user()->id && $address->archived_at === null,
            404
        );

        DB::transaction(function () use ($address) {
            $current = Address::whereKey($address->id)->lockForUpdate()->firstOrFail();
            abort_unless($current->archived_at === null, 404);
            if (Order::where('address_id', $current->id)->exists()) {
                $current->update(['archived_at' => now()]);
            } else {
                $current->delete();
            }
        });

        return response()->json([
            'message' => 'Address deleted successfully.',
        ]);
    }
}
