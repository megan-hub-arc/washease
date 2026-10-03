<?php

namespace App\Jobs;

use App\Notifications\OrderUpdateEmail;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;

class SendOrderEmail implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 30;

    public function __construct(public string $recipient, public array $update)
    {
        // Same database as the order: queue insertion rolls back with the update.
        $this->onConnection('order-mail')->onQueue('order-emails')->beforeCommit();
    }

    public function backoff(): array
    {
        return [30, 120];
    }

    public function handle(): void
    {
        Notification::route('mail', $this->recipient)->notify(new OrderUpdateEmail($this->update));
    }

    public function failed(?Throwable $exception): void
    {
        // Do not put customer addresses or SMTP credentials in this extra log entry.
        Log::warning('Order email exhausted retries; inspect failed_jobs.', [
            'order_id' => $this->update['order_id'], 'event' => $this->update['event'],
        ]);
    }
}
