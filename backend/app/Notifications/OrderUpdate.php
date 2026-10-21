<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

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
            'weighing' => 'Staff updated your laundry weight to '.($this->order->weight === null ? 'not recorded' : number_format((float) $this->order->weight, 2).' kg').'. Order total: '.($this->order->total_amount === null ? 'not recorded' : '₱'.number_format((float) $this->order->total_amount, 2)).'.',
            'requested_times' => $this->requestedTimesMessage(),
        };

        return [
            'order_id' => $this->order->id,
            'order_number' => $this->order->order_number,
            'event' => $this->event,
            'weight' => $this->order->weight,
            'total_amount' => $this->order->total_amount,
            'message' => $message,
            'pickup_requested_at' => $this->order->pickup_requested_at?->toIso8601String(),
            'delivery_requested_at' => $this->order->delivery_requested_at?->toIso8601String(),
        ];
    }

    private function requestedTimesMessage(): string
    {
        $details = [];
        foreach (['pickup_requested_at' => 'Requested pickup', 'delivery_requested_at' => 'Requested delivery'] as $field => $label) {
            if ($this->order->wasChanged($field)) {
                $previous = $this->order->getOriginal($field);
                $details[] = $label.': '.$this->timeLabel($previous).' → '.$this->timeLabel($this->order->{$field}).'.';
            }
        }

        return 'Staff updated your requested schedule. '.implode(' ', $details).' Contact the shop if this does not work for you. This notice is not your approval.';
    }

    private function timeLabel(mixed $value): string
    {
        return $value === null ? 'Not set' : Carbon::parse($value)->setTimezone('Asia/Manila')->format('M j, Y, g:i A').' PHT';
    }
}
