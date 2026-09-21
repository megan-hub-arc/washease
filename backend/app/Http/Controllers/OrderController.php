<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Services\ZtlpaScheduler;

class OrderController extends Controller
{
    public function schedule(Request $request, ZtlpaScheduler $scheduler)
    {
        $this->ensureStaffOrAdmin($request);

        $orders = Order::with('address.deliveryZone')
            ->where('status', 'Ready for Delivery')
            ->where('delivery_status', 'Unscheduled')
            ->get();

        $scheduledOrders = $scheduler->schedule($orders);

        return response()->json([
            'message' => 'ZTLPA scheduling completed successfully.',
            'orders' => $scheduledOrders,
        ]);
    }
    private function ensureStaffOrAdmin(Request $request): void
    {
        abort_unless(
            in_array($request->user()->role, ['staff', 'admin']),
            403
        );
    }

    private function ensureValidStatusTransition(Order $order, string $newStatus): void
    {
        $statuses = Order::STATUSES;

        $currentIndex = array_search($order->status, $statuses);
        $newIndex = array_search($newStatus, $statuses);

        abort_unless(
            $newIndex === $currentIndex + 1,
            422,
            'Invalid status transition.'
        );
    }

    public function index(Request $request)
    {
        return response()->json(
            $request->user()->orders()->latest()->get()
        );
    }

    public function staffIndex(Request $request)
    {
        $this->ensureStaffOrAdmin($request);

        return response()->json(
           Order::with(['user', 'address.deliveryZone'])->latest()->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'address_id' => ['required', 'integer', 'exists:addresses,id'],
            'service_type' => ['nullable', 'string', 'max:100'],
            'weight' => ['nullable', 'numeric', 'min:0'],
            'total_amount' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
            'requested_at' => ['nullable', 'date'],
        ]);

        $address = $request->user()
            ->addresses()
            ->findOrFail($validated['address_id']);

        $order = $request->user()->orders()->create([
            'address_id' => $address->id,
            'order_number' => 'WS-' . strtoupper(Str::random(8)),
            'service_type' => $validated['service_type'] ?? 'Laundry',
            'weight' => $validated['weight'] ?? null,
            'total_amount' => $validated['total_amount'],
            'status' => 'Pending',
            'notes' => $validated['notes'] ?? null,
            'requested_at' => $validated['requested_at'] ?? now(),
        ]);

        return response()->json([
            'message' => 'Order created successfully.',
            'order' => $order,
        ], 201);
    }

    public function show(Request $request, Order $order)
    {
        abort_unless($order->user_id === $request->user()->id, 404);

        return response()->json($order);
    }
    public function updateStatus(Request $request, Order $order)
    {
        $this->ensureStaffOrAdmin($request);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', Order::STATUSES)],
        ]);

        $this->ensureValidStatusTransition($order, $validated['status']);

        $order->update([
            'status' => $validated['status'],
        ]);

        return response()->json([
            'message' => 'Order status updated successfully.',
            'order' => $order,
        ]);
    }
}
