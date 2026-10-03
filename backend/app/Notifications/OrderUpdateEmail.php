<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

class OrderUpdateEmail extends Notification
{
    public function __construct(public array $update) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject('WashEase: '.$this->update['order_number'].' update')
            ->greeting('Your laundry order update')
            ->line('Order: '.$this->update['order_number'])
            ->line($this->update['message'])
            ->action('View your orders', rtrim(config('services.order_updates.frontend_url'), '/').'/customer')
            ->line('Requested times are subject to staff review. Contact the shop if you need help.');
        if ($this->update['event'] === 'requested_times') {
            foreach (['pickup_requested_at' => 'Requested pickup', 'delivery_requested_at' => 'Requested delivery'] as $key => $label) {
                $value = $this->update[$key] ?? null;
                $mail->line($label.': '.($value ? Carbon::parse($value)->timezone('Asia/Manila')->format('M j, Y g:i A').' PHT' : 'No time requested'));
            }
        }

        return $mail;
    }
}
