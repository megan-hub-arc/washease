<?php

namespace App\Observers;

use App\Models\Order;
use App\Notifications\OrderUpdate;

class OrderObserver
{
    public function created(Order $order): void
    {
        $this->notify($order, 'booked');
    }

    public function updated(Order $order): void
    {
        if ($order->wasChanged('status')) {
            $this->notify($order, 'status');
        }
        if ($order->wasChanged(['payment_status', 'payment_method'])) {
            $this->notify($order, 'payment');
        }
        if ($order->wasChanged(['pickup_requested_at', 'delivery_requested_at'])) {
            $this->notify($order, 'requested_times');
        }
    }

    private function notify(Order $order, string $event): void
    {
        if ($order->user?->role === 'customer') {
            // The database notification participates in the same transaction as the order.
            $order->user->notify(new OrderUpdate($order, $event));
        }
    }
}
