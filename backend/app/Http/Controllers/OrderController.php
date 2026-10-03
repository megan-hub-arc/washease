<?php

namespace App\Http\Controllers;

use App\Models\DeliveryRun;
use App\Models\Order;
use App\Services\OrderBooking;
use App\Services\ZtlpaScheduler;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function schedule(Request $request, ZtlpaScheduler $scheduler)
    {
        $this->ensureStaffOrAdmin($request);

        return DB::transaction(function () use ($scheduler) {
            // Assigned runs retain their established sequence; rebuild only the free queue.
            $orders = Order::with('address.deliveryZone')->where('status', 'Ready for Delivery')
                ->whereNull('delivery_run_id')->orderBy('id')->lockForUpdate()->get();
            $offset = (int) Order::where('status', 'Ready for Delivery')->whereNotNull('delivery_run_id')->max('delivery_sequence');
            $scheduledOrders = $scheduler->schedule($orders, $offset);
            $skipped = $orders->count() - $scheduledOrders->count();

            return response()->json([
                'message' => "Prioritized {$scheduledOrders->count()} unassigned orders. {$skipped} need a positive weight or an active delivery zone.",
                'orders' => $scheduledOrders,
            ]);
        });
    }

    public function updateRequestedTimes(Request $request, Order $order)
    {
        $this->ensureStaffOrAdmin($request);
        $validated = $request->validate([
            'pickup_requested_at' => ['present', 'nullable', 'date_format:Y-m-d\\TH:i:sP'],
            'delivery_requested_at' => ['present', 'nullable', 'date_format:Y-m-d\\TH:i:sP'],
        ]);
        $times = OrderBooking::normalizedTimes($validated);
        $updated = DB::transaction(function () use ($order, $times) {
            $current = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            abort_if($current->status === 'Delivered' || $current->delivery_run_id !== null, 422, 'Requested times cannot change after rider assignment or delivery.');
            foreach ($times as $field => $value) {
                if ($value === null) {
                    continue;
                }
                $time = Carbon::parse($value);
                // Retain an unchanged historical pickup request when adjusting delivery.
                if ($time->lessThanOrEqualTo(now()) && ! $current->$field?->equalTo($time)) {
                    throw ValidationException::withMessages([$field => ['A new requested time must be in the future.']]);
                }
            }
            $current->update($times + ['delivery_status' => 'Unscheduled', 'delivery_sequence' => null, 'scheduled_at' => null]);

            return $current->fresh()->load(['user', 'address.deliveryZone', 'deliveryRun.rider']);
        });

        return response()->json(['message' => 'Requested times saved. Schedule the order again when ready.', 'order' => $updated]);
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
            $request->user()->orders()->with('deliveryRun.rider:id,name,phone')->latest()->get()
        );
    }

    public function staffIndex(Request $request)
    {
        $this->ensureStaffOrAdmin($request);

        return response()->json(
            Order::with(['user', 'address.deliveryZone', 'deliveryRun.rider'])->latest()->get()
        );
    }

    public function store(Request $request, OrderBooking $booking)
    {
        $validated = $request->validate(OrderBooking::rules());
        $order = $booking->create($request->user(), $validated);

        return response()->json(['message' => 'Order created successfully.', 'order' => $order], 201);
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
            'status' => ['required', 'string', 'in:'.implode(',', Order::STATUSES)],
        ]);

        return DB::transaction(function () use ($order, $validated) {
            DeliveryRun::orderBy('id')->lockForUpdate()->get();
            $order = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            $this->ensureValidStatusTransition($order, $validated['status']);
            if ($validated['status'] === 'Delivered') {
                abort_unless($order->deliveryRun?->status === 'Started', 422, 'Start the assigned delivery run before marking this order Delivered.');
            }
            $order->update(['status' => $validated['status']]);
            if ($validated['status'] === 'Delivered' && ! $order->deliveryRun->orders()->where('status', '!=', 'Delivered')->exists()) {
                $order->deliveryRun->update(['status' => 'Completed', 'completed_at' => now()]);
            }

            return response()->json([
                'message' => 'Order status updated successfully.',
                'order' => $order->fresh()->load('deliveryRun.rider'),
            ]);
        });
    }

    public function updateWeight(Request $request, Order $order)
    {
        $this->ensureStaffOrAdmin($request);

        $validated = $request->validate([
            'weight' => ['required', 'numeric', 'gt:0'],
        ]);

        return DB::transaction(function () use ($order, $validated) {
            $order = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            abort_if($order->delivery_run_id !== null, 422, 'Weight cannot be changed after delivery assignment.');
            abort_if($order->payment_status === 'Paid', 422, 'Weight cannot be changed after payment confirmation.');
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
        });
    }

    public function updatePayment(Request $request, Order $order)
    {
        $this->ensureStaffOrAdmin($request);

        $validated = $request->validate([
            'payment_status' => ['required', 'string', 'in:Unpaid,Paid'],
            'payment_method' => ['required_if:payment_status,Paid', 'nullable', 'string', 'in:Cash,GCash'],
        ]);

        return DB::transaction(function () use ($order, $validated) {
            $order = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($validated['payment_status'] === 'Paid') {
                $order->update([
                    'payment_status' => 'Paid',
                    'payment_method' => $validated['payment_method'] ?? 'Cash',
                    'paid_at' => $order->paid_at ?? now(),
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
        });
    }

    public function reports(Request $request)
    {
        $this->ensureStaffOrAdmin($request);

        $dates = $request->validate([
            'from' => ['nullable', 'required_with:to', 'date_format:Y-m-d'],
            'to' => ['nullable', 'required_with:from', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $orders = Order::query();
        $collections = Order::where('payment_status', 'Paid');
        if (! empty($dates['from'])) {
            $start = Carbon::parse($dates['from'], 'Asia/Manila')->startOfDay()->setTimezone(config('app.timezone'));
            $end = Carbon::parse($dates['to'], 'Asia/Manila')->addDay()->startOfDay()->setTimezone(config('app.timezone'));
            $orders->where('created_at', '>=', $start)->where('created_at', '<', $end);
            $collections->where('paid_at', '>=', $start)->where('paid_at', '<', $end);
        }

        return response()->json([
            'period' => ['from' => $dates['from'] ?? null, 'to' => $dates['to'] ?? null, 'timezone' => 'Asia/Manila'],
            'total_orders' => (clone $orders)->count(),
            'total_revenue' => $collections->sum('total_amount'),
            'orders_by_status' => (clone $orders)->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status'),
            'payments' => [
                'paid' => (clone $orders)->where('payment_status', 'Paid')->count(),
                'unpaid' => (clone $orders)->where('payment_status', 'Unpaid')->count(),
            ],
        ]);
    }
}
