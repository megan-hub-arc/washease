<?php

namespace Tests\Feature;

use App\Jobs\SendOrderEmail;
use App\Models\Address;
use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderUpdateEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class OrderEmailTest extends TestCase
{
    use RefreshDatabase;

    private function order(?string $email = 'customer@example.test'): Order
    {
        $customer = User::factory()->create(['role' => 'customer', 'email' => $email]);
        $address = Address::create(['user_id' => $customer->id, 'address' => 'Test street']);

        return Order::create(['user_id' => $customer->id, 'address_id' => $address->id, 'order_number' => 'WS-EMAIL', 'status' => 'Pending']);
    }

    public function test_email_is_opt_in_and_dashboard_notice_remains_available(): void
    {
        config(['services.order_updates.email_enabled' => false]);
        $order = $this->order();
        $this->assertDatabaseCount('jobs', 0);
        $this->assertEquals(1, $order->user->notifications()->count());
    }

    public function test_customers_without_email_still_receive_dashboard_notice(): void
    {
        config(['services.order_updates.email_enabled' => true]);
        $order = $this->order(null);
        $this->assertDatabaseCount('jobs', 0);
        $this->assertEquals(1, $order->user->notifications()->count());
    }

    public function test_queue_payload_preserves_event_snapshot_and_skips_noop_updates(): void
    {
        config(['services.order_updates.email_enabled' => true]);
        Queue::fake();
        $order = $this->order();
        $order->update(['status' => 'Confirmed']);
        $order->update(['status' => 'Confirmed']);
        Queue::assertPushed(SendOrderEmail::class, 2);
        Queue::assertPushed(SendOrderEmail::class, fn ($job) => $job->update['event'] === 'booked' && str_contains($job->update['message'], 'received') && $job->recipient === 'customer@example.test' && $job->connection === 'order-mail');
        Queue::assertPushed(SendOrderEmail::class, fn ($job) => $job->update['event'] === 'status' && str_contains($job->update['message'], 'Confirmed'));
    }

    public function test_rollback_removes_queued_emails_and_dashboard_notices(): void
    {
        config(['services.order_updates.email_enabled' => true]);
        DB::beginTransaction();
        try {
            $this->order();
            $this->assertDatabaseCount('jobs', 1);
        } finally {
            DB::rollBack();
        }
        $this->assertDatabaseCount('jobs', 0);
        $this->assertDatabaseCount('notifications', 0);
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_worker_sends_only_to_snapshot_recipient_with_customer_link(): void
    {
        Notification::fake();
        config(['services.order_updates.frontend_url' => 'https://wash.example.test']);
        $job = new SendOrderEmail('customer@example.test', ['order_id' => 1, 'order_number' => 'WS-EMAIL', 'event' => 'status', 'message' => 'Your order is now Confirmed.']);
        $job->handle();
        Notification::assertSentOnDemand(OrderUpdateEmail::class, function ($notice, $channels, $recipient) {
            $mail = $notice->toMail($recipient);

            return $recipient->routes['mail'] === 'customer@example.test' && $mail->actionUrl === 'https://wash.example.test/customer' && in_array('Your order is now Confirmed.', $mail->introLines);
        });
    }

    public function test_transport_failure_leaves_order_and_notice_intact_and_can_retry(): void
    {
        config(['services.order_updates.email_enabled' => true]);
        $order = $this->order();
        Notification::shouldReceive('send')->once()->andThrow(new \RuntimeException('Transport unavailable'));
        $job = new SendOrderEmail('customer@example.test', ['order_id' => $order->id, 'order_number' => 'WS-EMAIL', 'event' => 'booked', 'message' => 'Received']);
        try {
            $job->handle();
            $this->fail('Transport error must propagate to the worker.');
        } catch (\RuntimeException $exception) {
            $this->assertEquals('Transport unavailable', $exception->getMessage());
        }
        $this->assertEquals('Pending', $order->fresh()->status);
        $this->assertEquals(1, $order->user->notifications()->count());
        $this->assertEquals(3, $job->tries);
        $this->assertEquals([30, 120], $job->backoff());
    }
}
