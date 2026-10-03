<?php

namespace App\Http\Controllers;

use App\Models\DeliveryRun;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DeliveryRunController extends Controller
{
    private function ensureStaffOrAdmin(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['staff', 'admin']), 403);
    }

    public function riders(Request $request): JsonResponse
    {
        $this->ensureStaffOrAdmin($request);

        $riders = User::where('role', 'rider')->select('id', 'name', 'email', 'phone', 'rider_on_duty')
            ->with(['deliveryRuns' => fn ($query) => $query->whereIn('status', ['Planned', 'Started', 'Completed'])->whereNull('returned_at')->orderBy('id')])->orderBy('name')->get();

        return response()->json($riders->map(function (User $rider) {
            $active = $rider->deliveryRuns->first(fn (DeliveryRun $run) => in_array($run->status, ['Started', 'Completed']));
            $planned = $rider->deliveryRuns->firstWhere('status', 'Planned');
            $availability = $active ? ($active->status === 'Completed' ? 'Awaiting return' : 'Out on delivery')
                : (! $rider->rider_on_duty ? 'Off duty' : ($planned ? 'Assigned, awaiting departure' : 'Available'));

            return ['id' => $rider->id, 'name' => $rider->name, 'email' => str_ends_with($rider->email, '@riders.invalid') ? null : $rider->email, 'phone' => $rider->phone,
                'rider_on_duty' => $rider->rider_on_duty, 'availability' => $availability,
                'current_run' => $active, 'planned_run_ids' => $rider->deliveryRuns->where('status', 'Planned')->pluck('id')->values()];
        }));
    }

    public function storeRider(Request $request): JsonResponse
    {
        $this->ensureStaffOrAdmin($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
        ]);
        $rider = User::create([
            ...$data, 'role' => 'rider',
            'email' => 'rider-'.Str::uuid().'@riders.invalid',
            'password' => Str::random(64),
        ]);

        return response()->json(['id' => $rider->id, 'message' => 'Rider added.'], 201);
    }

    public function updateRider(Request $request, User $rider): JsonResponse
    {
        $this->ensureStaffOrAdmin($request);
        abort_unless($rider->role === 'rider', 404);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
        ]);
        $rider->update($data);

        return response()->json(['message' => 'Rider contact updated.']);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureStaffOrAdmin($request);

        return response()->json(DeliveryRun::with('rider', 'orders')->latest()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureStaffOrAdmin($request);
        $validated = $request->validate([
            'rider_id' => ['required', 'integer', 'exists:users,id'],
            'capacity_kg' => ['required', 'numeric', 'min:0.01', 'max:999999.99'],
            'max_orders' => ['required', 'integer', 'min:1', 'max:1000'],
            'scheduled_at' => ['nullable', 'date'],
            'order_ids' => ['sometimes', 'array', 'min:1'],
            'order_ids.*' => ['integer', 'distinct', 'exists:orders,id'],
        ]);
        abort_unless(User::findOrFail($validated['rider_id'])->role === 'rider', 422, 'Selected user is not a rider.');

        return DB::transaction(function () use ($request, $validated) {
            DeliveryRun::orderBy('id')->lockForUpdate()->get();
            $run = DeliveryRun::create([
                'rider_id' => $validated['rider_id'], 'status' => 'Planned',
                'capacity_kg' => $validated['capacity_kg'], 'max_orders' => $validated['max_orders'],
                'total_load_kg' => 0, 'scheduled_at' => $validated['scheduled_at'] ?? null,
            ]);
            if (isset($validated['order_ids'])) {
                $this->assign($request, $run, $validated['order_ids']);
            }

            return response()->json(['delivery_run' => $run->fresh()->load('rider', 'orders')], 201);
        });
    }

    public function assignOrders(Request $request, DeliveryRun $deliveryRun): JsonResponse
    {
        $this->ensureStaffOrAdmin($request);
        $validated = $request->validate([
            'order_ids' => ['required', 'array', 'min:1'],
            'order_ids.*' => ['required', 'integer', 'distinct', 'exists:orders,id'],
        ]);

        return DB::transaction(function () use ($request, $deliveryRun, $validated) {
            $runs = DeliveryRun::orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $run = $runs->get($deliveryRun->id);
            $this->assign($request, $run, $validated['order_ids']);

            return response()->json(['delivery_run' => $run->fresh()->load('rider', 'orders')]);
        });
    }

    private function assign(Request $request, DeliveryRun $run, array $orderIds): void
    {
        abort_unless($run->status === 'Planned' && $run->started_at === null, 422, 'Only planned runs accept assignments.');
        $orders = Order::whereIn('id', $orderIds)->orderBy('id')->lockForUpdate()->get();
        $affectedRuns = [$run->id];
        foreach ($orders as $order) {
            abort_unless($order->status === 'Ready for Delivery' && $order->delivery_status === 'Scheduled' && $order->delivery_sequence !== null, 422, "Order {$order->order_number} must be scheduled and ready.");
            abort_unless((float) $order->weight > 0, 422, 'Record a positive weight before assignment.');
            if ($order->delivery_run_id !== null) {
                abort_if($order->delivery_run_id === $run->id, 422, 'Order is already assigned to this run.');
                $source = DeliveryRun::findOrFail($order->delivery_run_id);
                abort_unless($source->status === 'Planned' && $source->started_at === null, 422, 'Reassignment is only allowed before departure.');
                $affectedRuns[] = $source->id;
            }
        }
        $existing = $run->orders()->get();
        abort_if($existing->count() + $orders->count() > $run->max_orders, 422, 'Maximum orders per run exceeded.');
        $load = round((float) $existing->sum('weight') + (float) $orders->sum('weight'), 2);
        abort_if($load > (float) $run->capacity_kg, 422, 'Delivery run weight capacity exceeded.');
        foreach ($orders as $order) {
            DB::table('delivery_assignment_events')->insert([
                'order_id' => $order->id, 'from_run_id' => $order->delivery_run_id,
                'to_run_id' => $run->id, 'staff_id' => $request->user()->id, 'created_at' => now(),
            ]);
            $order->update(['delivery_run_id' => $run->id]);
        }
        foreach (array_unique($affectedRuns) as $runId) {
            DeliveryRun::whereKey($runId)->update(['total_load_kg' => Order::where('delivery_run_id', $runId)->sum('weight')]);
        }
    }

    public function start(Request $request, DeliveryRun $deliveryRun): JsonResponse
    {
        $this->ensureStaffOrAdmin($request);

        return DB::transaction(function () use ($deliveryRun) {
            $runs = DeliveryRun::orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $run = $runs->get($deliveryRun->id);
            $rider = User::whereKey($run->rider_id)->lockForUpdate()->firstOrFail();
            abort_unless($rider->rider_on_duty, 422, 'Rider is off duty.');
            abort_if($runs->contains(fn (DeliveryRun $other) => $other->rider_id === $run->rider_id && $other->id !== $run->id && in_array($other->status, ['Started', 'Completed']) && $other->returned_at === null), 422, 'Confirm the rider returned from their previous run before another departure.');
            abort_unless($run->status === 'Planned', 422, 'Run has already departed.');
            $orders = $run->orders()->lockForUpdate()->get();
            abort_if($orders->isEmpty(), 422, 'Cannot depart with an empty run.');
            abort_if($orders->contains(fn (Order $order) => $order->status !== 'Ready for Delivery'), 422, 'All assigned orders must be ready.');
            $run->update(['status' => 'Started', 'started_at' => now()]);

            return response()->json(['delivery_run' => $run->fresh()->load('rider', 'orders')]);
        });
    }

    public function confirmReturn(Request $request, DeliveryRun $deliveryRun): JsonResponse
    {
        $this->ensureStaffOrAdmin($request);

        return DB::transaction(function () use ($request, $deliveryRun) {
            $runs = DeliveryRun::orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $run = $runs->get($deliveryRun->id);
            abort_unless($run->status === 'Completed', 422, 'Finish all deliveries before confirming return.');
            abort_if($run->returned_at !== null, 422, 'Return has already been confirmed.');
            $run->update(['returned_at' => now(), 'return_confirmed_by' => $request->user()->id]);

            return response()->json(['delivery_run' => $run->fresh()->load('rider', 'orders')]);
        });
    }

    public function updateDuty(Request $request, User $rider): JsonResponse
    {
        $this->ensureStaffOrAdmin($request);
        abort_unless($rider->role === 'rider', 404);
        $validated = $request->validate(['rider_on_duty' => ['required', 'boolean']]);

        return DB::transaction(function () use ($rider, $validated) {
            DeliveryRun::orderBy('id')->lockForUpdate()->get();
            $rider = User::whereKey($rider->id)->lockForUpdate()->firstOrFail();
            $rider->rider_on_duty = $validated['rider_on_duty'];
            $rider->save();

            return response()->json(['message' => 'Duty status updated.']);
        });
    }
}
