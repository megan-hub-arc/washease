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
        'service_id' => ['required', 'integer', 'exists:services,id'],
        'notes' => ['nullable', 'string', 'max:500'],
        'requested_at' => ['nullable', 'date'],
    ]);

        $address = $request->user()
            ->addresses()
            ->findOrFail($validated['address_id']);

            $service = \App\Models\Service::where('id', $validated['service_id'])
                ->where('is_active', true)
                ->firstOrFail();

            $totalAmount = $service->pricing_type === 'fixed'
                ? $service->rate
                : 0;

       $order = $request->user()->orders()->create([
            'address_id' => $address->id,
            'service_id' => $service->id,
            'order_number' => 'WS-' . strtoupper(Str::random(8)),
            'service_type' => $service->name,
            'weight' => null,
            'total_amount' => $totalAmount,
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
    public function updateWeight(Request $request, Order $order)
{
    $this->ensureStaffOrAdmin($request);

    $validated = $request->validate([
        'weight' => ['required', 'numeric', 'gt:0'],
    ]);

    $order->load('service');

    abort_unless(
        $order->service,
        422,
        'This order does not have a configured service.'
    );

    $weight = (float) $validated['weight'];

    $totalAmount = $order->service->pricing_type === 'per_kg'
        ? $weight * (float) $order->service->rate
        : (float) $order->service->rate;

    $order->update([
        'weight' => $weight,
        'total_amount' => round($totalAmount, 2),
    ]);

    return response()->json([
        'message' => 'Order weight and total amount updated successfully.',
        'order' => $order->fresh('service'),
    ]);
}
    public function updatePayment(Request $request, Order $order)
{
    $this->ensureStaffOrAdmin($request);

    $validated = $request->validate([
        'payment_status' => ['required', 'string', 'in:Unpaid,Paid'],
        'payment_method' => ['nullable', 'string', 'in:Cash,GCash,Other'],
    ]);

    if ($validated['payment_status'] === 'Paid') {
        $order->update([
            'payment_status' => 'Paid',
            'payment_method' => $validated['payment_method'] ?? 'Cash',
            'paid_at' => now(),
        ]);
    } else {
        $order->update([
            'payment_status' => 'Unpaid',
            'payment_method' => null,
            'paid_at' => null,
        ]);
    }

    return response()->json([
        'message' => 'Payment status updated successfully.',
        'order' => $order->fresh(),
    ]);
    }
    public function reports(Request $request)
{
    $this->ensureStaffOrAdmin($request);

    return response()->json([
        'total_orders' => Order::count(),

        'total_revenue' => Order::where('payment_status', 'Paid')
            ->sum('total_amount'),

        'orders_by_status' => Order::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status'),

        'payments' => [
            'paid' => Order::where('payment_status', 'Paid')->count(),
            'unpaid' => Order::where('payment_status', 'Unpaid')->count(),
        ],
    ]);
}
}
