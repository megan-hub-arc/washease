<?php

namespace App\Http\Controllers;

use App\Models\DeliveryRun;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DeliveryRunController extends Controller
{
    private function ensureStaffOrAdmin(Request $request): void
    {
        abort_unless(
            in_array($request->user()->role, ['staff', 'admin']),
            403
        );
    }

    public function store(Request $request)
    {
        $this->ensureStaffOrAdmin($request);

        $validated = $request->validate([
            'rider_id' => ['required', 'integer', 'exists:users,id'],
            'capacity_kg' => ['nullable', 'numeric', 'min:0.01'],
            'scheduled_at' => ['nullable', 'date'],
        ]);

        $rider = User::findOrFail($validated['rider_id']);

        abort_unless(
            $rider->role === 'rider',
            422,
            'Selected user is not a rider.'
        );

        $run = DeliveryRun::create([
            'rider_id' => $rider->id,
            'status' => 'Planned',
            'capacity_kg' => $validated['capacity_kg'] ?? 8,
            'total_load_kg' => 0,
            'scheduled_at' => $validated['scheduled_at'] ?? null,
        ]);

        return response()->json([
            'message' => 'Delivery run created successfully.',
            'delivery_run' => $run->load('rider'),
        ], 201);
    }

    public function assignOrders(Request $request, DeliveryRun $deliveryRun)
    {
        $this->ensureStaffOrAdmin($request);

        $validated = $request->validate([
            'order_ids' => ['required', 'array', 'min:1'],
            'order_ids.*' => ['required', 'integer', 'distinct', 'exists:orders,id'],
        ]);

        return DB::transaction(function () use ($validated, $deliveryRun) {
            $orders = Order::whereIn('id', $validated['order_ids'])
                ->lockForUpdate()
                ->get();

            abort_unless(
                $orders->count() === count($validated['order_ids']),
                422,
                'One or more orders could not be found.'
            );

            foreach ($orders as $order) {
                abort_unless(
                    $order->status === 'Ready for Delivery',
                    422,
                    "Order {$order->order_number} is not ready for delivery."
                );

                abort_unless(
                    $order->delivery_status === 'Scheduled',
                    422,
                    "Order {$order->order_number} is not scheduled."
                );

                abort_unless(
                    $order->delivery_run_id === null,
                    422,
                    "Order {$order->order_number} is already assigned to a delivery run."
                );
            }

            $additionalLoad = $orders->sum(
                fn (Order $order) => (float) ($order->weight ?? 0)
            );

            $currentLoad = (float) $deliveryRun->total_load_kg;
            $capacity = (float) $deliveryRun->capacity_kg;

            abort_unless(
                ($currentLoad + $additionalLoad) <= $capacity,
                422,
                'Assigning these orders would exceed the delivery run capacity.'
            );

            $newTotalLoad = $currentLoad + $additionalLoad;

            foreach ($orders as $order) {
                $order->update([
                    'delivery_run_id' => $deliveryRun->id,
                ]);
            }

            $deliveryRun->update([
                'total_load_kg' => $newTotalLoad,
            ]);

            return response()->json([
                'message' => 'Orders assigned to delivery run successfully.',
                'delivery_run' => $deliveryRun->fresh()->load('rider', 'orders'),
            ]);
        });
    }
}
