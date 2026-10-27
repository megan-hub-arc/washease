<?php

namespace App\Observers;

use App\Models\AuditLog;
use App\Models\Order;
use App\Services\CustomerOrderUpdates;

class OrderObserver
{
    public function created(Order $order): void
    {
        $this->notify($order, 'booked');
    }

    public function updated(Order $order): void
    {
        foreach (['order_status', 'order_payment', 'order_assignment', 'order_weight', 'order_requested_times'] as $action) {
            AuditLog::recordChanges($order, $action);
        }
        if ($order->wasChanged('status')) {
            $this->notify($order, 'status');
        }
        if ($order->wasChanged(['payment_status', 'payment_method'])) {
            $this->notify($order, 'payment');
        }
        if ($order->wasChanged(['weight', 'total_amount'])) {
            $this->notify($order, 'weighing');
        }
        if ($order->wasChanged(['pickup_requested_at', 'delivery_requested_at'])) {
            $this->notify($order, 'requested_times');
        }
    }

    private function notify(Order $order, string $event): void
    {
        CustomerOrderUpdates::send($order, $event);
    }
}
