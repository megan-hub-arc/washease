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
                    && $order->address?->deliveryZone?->is_active;
            })
            ->sort(function (Order $a, Order $b) {
                $zoneA = $a->address->deliveryZone->priority_order;
                $zoneB = $b->address->deliveryZone->priority_order;

                if ($zoneA !== $zoneB) {
                    return $zoneA <=> $zoneB;
                }

                $timeA = $a->requested_at?->timestamp ?? PHP_INT_MAX;
                $timeB = $b->requested_at?->timestamp ?? PHP_INT_MAX;

                if ($timeA !== $timeB) {
                    return $timeA <=> $timeB;
                }

                $loadA = (float) ($a->weight ?? 0);
                $loadB = (float) ($b->weight ?? 0);

                return $loadB <=> $loadA;
            })
            ->values();
    }

    public function schedule(Collection $orders): Collection
    {
        $prioritizedOrders = $this->prioritize($orders);

        foreach ($prioritizedOrders as $index => $order) {
            $order->update([
                'delivery_sequence' => $index + 1,
                'delivery_status' => 'Scheduled',
            ]);
        }

        return $prioritizedOrders->fresh();
    }
}
