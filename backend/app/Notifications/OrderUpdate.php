<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Notifications\Notification;

class OrderUpdate extends Notification
{
    public function __construct(public Order $order, public string $event) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $message = match ($this->event) {
            'booked' => 'Your booking was received. Staff will review your request.',
            'status' => 'Your order is now '.$this->order->status.'.',
            'departed' => 'Your rider has departed. Your order is out for delivery.',
            'payment' => $this->order->payment_status === 'Paid'
                ? 'Staff recorded payment via '.$this->order->payment_method.'.'
                : 'Staff marked your payment as unpaid. Contact the shop if you have already paid.',
            'requested_times' => 'Staff updated your requested pickup or delivery time. Check your order for the details.',
        };

        return [
            'order_id' => $this->order->id,
            'order_number' => $this->order->order_number,
            'event' => $this->event,
            'message' => $message,
            'pickup_requested_at' => $this->order->pickup_requested_at?->toIso8601String(),
            'delivery_requested_at' => $this->order->delivery_requested_at?->toIso8601String(),
        ];
    }
}
