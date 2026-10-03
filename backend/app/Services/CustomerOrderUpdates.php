<?php

namespace App\Services;

use App\Events\CustomerOrdersChanged;
use App\Jobs\SendOrderEmail;
use App\Models\Order;
use App\Notifications\OrderUpdate;
use Illuminate\Support\Facades\DB;

class CustomerOrderUpdates
{
    public static function send(Order $order, string $event): void
    {
        $customer = $order->user;
        if ($customer?->role !== 'customer') {
            return;
        }

        DB::transaction(function () use ($customer, $order, $event): void {
            $notice = new OrderUpdate($order, $event);
            $customer->notify($notice);
            if (config('services.order_updates.live_enabled')) {
                event(new CustomerOrdersChanged($customer->id));
            }
            if (config('services.order_updates.email_enabled') && filled($customer->email)) {
                SendOrderEmail::dispatch($customer->email, $notice->toArray($customer));
            }
        });
    }
}
