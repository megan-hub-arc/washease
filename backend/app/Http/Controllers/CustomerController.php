<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\OrderBooking;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CustomerController extends Controller
{
    public function profile(Request $request)
    {
        return response()->json([
            'user' => $request->user(),
        ]);
    }

    public function updateProfile(Request $request)
    {
        abort_unless($request->user()->role === 'customer', 403);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'required_without:phone', 'email', 'max:255', Rule::unique('users')->ignore($request->user()->id)],
            'phone' => ['nullable', 'required_without:email', 'string', 'regex:/^\+?[0-9]{7,15}$/', Rule::unique('users', 'phone')->ignore($request->user()->id)],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'current_password' => ['required_with:password', 'string'],
        ]);
        if (! empty($validated['password']) && ! Hash::check($validated['current_password'], $request->user()->password)) {
            throw ValidationException::withMessages(['current_password' => ['Your current password is incorrect.']]);
        }
        unset($validated['current_password']);
        if (empty($validated['password'])) {
            unset($validated['password']);
        }
        $request->user()->update($validated);

        return response()->json(['user' => $request->user()->fresh()]);
    }

    public function staffStore(Request $request)
    {
        $this->ensureStaffOrAdmin($request);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['required', 'string', 'regex:/^\+?[0-9]{7,15}$/', 'unique:users,phone'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'address' => ['required', 'string', 'max:500'],
            'label' => ['nullable', 'string', 'max:50'],
            'zone' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);
        $customer = DB::transaction(function () use ($validated) {
            $customer = User::create([
                'name' => $validated['name'], 'email' => $validated['email'] ?? null,
                'phone' => $validated['phone'], 'password' => $validated['password'], 'role' => 'customer',
            ]);
            $customer->addresses()->create([
                'label' => $validated['label'] ?? 'Home', 'address' => $validated['address'],
                'zone' => $validated['zone'] ?? null, 'notes' => $validated['notes'] ?? null,
            ]);

            return $customer->load(['addresses.deliveryZone', 'orders']);
        });

        return response()->json(['customer' => $customer, 'message' => 'Customer registered.'], 201);
    }

    public function staffAddress(Request $request, User $customer)
    {
        $this->ensureStaffOrAdmin($request);
        abort_unless($customer->role === 'customer', 404);
        $validated = $request->validate([
            'address' => ['required', 'string', 'max:500'], 'label' => ['nullable', 'string', 'max:50'],
            'zone' => ['nullable', 'string', 'max:100'], 'notes' => ['nullable', 'string', 'max:500'],
        ]);
        $address = $customer->addresses()->create($validated);

        return response()->json(['address' => $address->fresh()->load('deliveryZone')], 201);
    }

    public function staffOrder(Request $request, User $customer, OrderBooking $booking)
    {
        $this->ensureStaffOrAdmin($request);
        abort_unless($customer->role === 'customer', 404);
        $order = $booking->create($customer, $request->validate(OrderBooking::rules()));

        return response()->json(['order' => $order, 'message' => 'Order created for '.$customer->name.'.'], 201);
    }

    public function staffIndex(Request $request)
    {
        $this->ensureStaffOrAdmin($request);

        return response()->json(
            User::where('role', 'customer')
                ->with([
                    'addresses' => fn ($query) => $query->whereNull('archived_at')->with('deliveryZone'),
                    'orders',
                ])
                ->orderBy('name')
                ->get()
        );
    }

    private function ensureStaffOrAdmin(Request $request): void
    {
        abort_unless(
            in_array($request->user()->role, ['staff', 'admin']),
            403
        );
    }
}
