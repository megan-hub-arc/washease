<?php

namespace App\Http\Controllers;

use App\Models\Address;
use Illuminate\Http\Request;

class AddressController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(
            $request->user()->addresses()->latest()->get()
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
        abort_unless($address->user_id === $request->user()->id, 404);

        return response()->json($address);
    }

    public function update(Request $request, Address $address)
    {
        abort_unless($address->user_id === $request->user()->id, 404);

        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:50'],
            'address' => ['required', 'string', 'max:500'],
            'zone' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $address->update($validated);

        return response()->json([
            'message' => 'Address updated successfully.',
            'address' => $address,
        ]);
    }

    public function destroy(Request $request, Address $address)
    {
        abort_unless($address->user_id === $request->user()->id, 404);

        $address->delete();

        return response()->json([
            'message' => 'Address deleted successfully.',
        ]);
    }
}
