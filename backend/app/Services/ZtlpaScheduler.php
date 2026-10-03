<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Collection;

class ZtlpaScheduler
{
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

    public function schedule(Collection $orders, int $offset = 0): Collection
    {
        $prioritizedOrders = $this->prioritize($orders);

        $eligibleIds = $prioritizedOrders->pluck('id');
        foreach ($orders as $order) {
            if ($order->delivery_run_id === null && ! $eligibleIds->contains($order->id)) {
                $order->update(['delivery_status' => 'Unscheduled', 'delivery_sequence' => null, 'scheduled_at' => null]);
            }
        }

        foreach ($prioritizedOrders as $index => $order) {
            $order->update([
                'delivery_sequence' => $offset + $index + 1,
                'scheduled_at' => now(),
                'delivery_status' => 'Scheduled',
            ]);
        }

        return $prioritizedOrders->fresh();
    }
}
