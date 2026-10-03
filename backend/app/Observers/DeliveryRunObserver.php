<?php

namespace App\Observers;

use App\Models\DeliveryRun;
use App\Notifications\OrderUpdate;

class DeliveryRunObserver
{
    public function updated(DeliveryRun $run): void
    {
        if ($run->wasChanged('status') && $run->status === 'Started') {
            foreach ($run->orders()->with('user')->get() as $order) {
                if ($order->user?->role === 'customer') {
                    $order->user->notify(new OrderUpdate($order, 'departed'));
                }
            }
        }
    }
}
