<?php

namespace App\Services;

use App\Models\DeliveryRun;
use App\Models\DeliveryZone;
use App\Models\Order;
use Closure;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ZtlpaScheduler
{
    /**
     * Apply a scheduling input change and rebuild the free queue atomically.
     * Assigned runs retain their existing order sequence and load.
     */
    public function synchronize(?Closure $change = null): Collection
    {
        return DB::transaction(function () use ($change): Collection {
            DeliveryZone::select('id')->orderBy('id')->lockForUpdate()->get();
            DeliveryRun::select('id')->orderBy('id')->lockForUpdate()->get();
            Order::select('id')->whereNull('delivery_run_id')->orderBy('id')->lockForUpdate()->get();
            if ($change !== null) {
                $change();
            }
            $orders = Order::with('address.deliveryZone')->whereNull('delivery_run_id')
                ->where(function ($query) {
                    $query->where('status', 'Ready for Delivery')
                        ->orWhere(function ($stale) {
                            $stale->where('delivery_status', 'Scheduled')->where('status', '!=', 'Delivered');
                        });
                })->orderBy('id')->get();
            $offset = (int) Order::where('status', 'Ready for Delivery')->whereNotNull('delivery_run_id')->max('delivery_sequence');

            return $this->schedule($orders, $offset);
        }, 3);
    }

    public function prioritize(Collection $orders): Collection
    {
        return $orders
            ->filter(function (Order $order) {
                return $order->status === 'Ready for Delivery'
                    && $order->delivery_run_id === null
                    && (float) $order->weight > 0
                    && $order->address?->deliveryZone?->is_active;
            })
            ->sort(function (Order $a, Order $b) {
                $zoneA = $a->address->deliveryZone->priority_order;
                $zoneB = $b->address->deliveryZone->priority_order;

                if ($zoneA !== $zoneB) {
                    return $zoneA <=> $zoneB;
                }

                // Equal-priority zones remain contiguous, with stable zone-ID ordering.
                if ($a->address->delivery_zone_id !== $b->address->delivery_zone_id) {
                    return $a->address->delivery_zone_id <=> $b->address->delivery_zone_id;
                }

                $timeA = $a->delivery_requested_at?->timestamp ?? PHP_INT_MAX;
                $timeB = $b->delivery_requested_at?->timestamp ?? PHP_INT_MAX;

                if ($timeA !== $timeB) {
                    return $timeA <=> $timeB;
                }

                $loadA = (float) ($a->weight ?? 0);
                $loadB = (float) ($b->weight ?? 0);

                return ($loadB <=> $loadA) ?: ($a->id <=> $b->id);
            })
            ->values();
    }

    /**
     * @return array{batches: array<int, array<string, mixed>>, overweight: array<int, array<string, mixed>>}
     */
    public function previewBatches(Collection $orders, float $capacityKg, int $maxOrders): array
    {
        $capacity = (int) round($capacityKg * 100);
        $batches = [];
        $overweight = [];
        $current = null;
        $load = 0;
        foreach ($this->prioritize($orders) as $order) {
            $zone = $order->address->deliveryZone;
            $weight = (int) round((float) $order->weight * 100);
            $item = ['id' => $order->id, 'order_number' => $order->order_number, 'weight' => $weight / 100];
            if ($weight > $capacity) {
                $overweight[] = $item + ['zone_name' => $zone->name];

                continue;
            }
            if ($current !== null && ($current['zone_id'] !== $zone->id || $load + $weight > $capacity || count($current['orders']) >= $maxOrders)) {
                $batches[] = $current;
                $current = null;
            }
            if ($current === null) {
                $current = ['zone_id' => $zone->id, 'zone_name' => $zone->name, 'orders' => [], 'total_load_kg' => 0];
                $load = 0;
            }
            $current['orders'][] = $item;
            $load += $weight;
            $current['total_load_kg'] = $load / 100;
        }
        if ($current !== null) {
            $batches[] = $current;
        }

        return ['batches' => $batches, 'overweight' => $overweight];
    }

    public function schedule(Collection $orders, int $offset = 0): Collection
    {
        $prioritizedOrders = $this->prioritize($orders);

        $eligibleIds = $prioritizedOrders->pluck('id');
        foreach ($orders as $order) {
            if ($order->delivery_run_id === null && ! $eligibleIds->contains($order->id)) {
                $order->updateQuietly(['delivery_status' => 'Unscheduled', 'delivery_sequence' => null, 'scheduled_at' => null]);
            }
        }

        foreach ($prioritizedOrders as $index => $order) {
            $sequence = $offset + $index + 1;
            if ($order->delivery_sequence !== $sequence || $order->delivery_status !== 'Scheduled' || $order->scheduled_at === null) {
                $order->updateQuietly([
                    'delivery_sequence' => $sequence,
                    'scheduled_at' => now(),
                    'delivery_status' => 'Scheduled',
                ]);
            }
        }

        return $prioritizedOrders->fresh();
    }
}
