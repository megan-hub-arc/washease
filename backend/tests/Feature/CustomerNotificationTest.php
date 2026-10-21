<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\DeliveryRun;
use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderUpdate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function order(User $customer, string $status = 'Pending'): Order
    {
        $address = Address::create(['user_id' => $customer->id, 'address' => 'Customer street']);

        return Order::create(['user_id' => $customer->id, 'address_id' => $address->id, 'order_number' => fake()->unique()->bothify('WS-########'), 'status' => $status, 'weight' => 3]);
    }

    public function test_notifications_are_private_and_read_state_survives_subsequent_requests(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $other = User::factory()->create(['role' => 'customer']);
        $order = $this->order($customer);
        $this->order($other);
        $this->getJson('/api/customer/notifications')->assertUnauthorized();
        Sanctum::actingAs($customer);
        $response = $this->getJson('/api/customer/notifications')->assertOk()->assertJsonCount(1, 'notifications')->assertJsonPath('unread_count', 1)->assertJsonPath('notifications.0.data.order_id', $order->id);
        $id = $response->json('notifications.0.id');
        $otherId = $other->notifications()->firstOrFail()->id;
        $this->putJson('/api/customer/notifications/'.$otherId.'/read')->assertNotFound();
        $this->putJson('/api/customer/notifications/'.$id.'/read')->assertOk();
        $this->putJson('/api/customer/notifications/'.$id.'/read')->assertOk();
        $this->getJson('/api/customer/notifications')->assertOk()->assertJsonPath('unread_count', 0);
        $this->assertNotNull($customer->notifications()->findOrFail($id)->read_at);
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $this->getJson('/api/customer/notifications')->assertForbidden();
        $this->putJson('/api/customer/notifications/'.$id.'/read')->assertForbidden();
    }

    public function test_status_updates_notify_once_and_rejected_transitions_do_not_notify(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $order = $this->order($customer);
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $this->putJson('/api/orders/'.$order->id.'/status', ['status' => 'Confirmed'])->assertOk();
        $this->assertEquals(2, $customer->notifications()->count());
        $this->assertTrue($customer->notifications()->get()->contains(fn ($notice) => $notice->data['event'] === 'status' && str_contains($notice->data['message'], 'Confirmed')));
        $this->putJson('/api/orders/'.$order->id.'/status', ['status' => 'Confirmed'])->assertUnprocessable();
        $this->putJson('/api/orders/'.$order->id.'/status', ['status' => 'Delivered'])->assertUnprocessable();
        $this->assertEquals(2, $customer->notifications()->count());
        $order->update(['delivery_sequence' => 1, 'delivery_status' => 'Scheduled']);
        $this->assertEquals(2, $customer->notifications()->count());
    }

    public function test_departure_notifies_each_customer_and_failed_repeat_does_not_duplicate(): void
    {
        $a = User::factory()->create(['role' => 'customer']);
        $b = User::factory()->create(['role' => 'customer']);
        $first = $this->order($a, 'Ready for Delivery');
        $second = $this->order($b, 'Ready for Delivery');
        $run = DeliveryRun::create(['rider_id' => User::factory()->create(['role' => 'rider'])->id, 'status' => 'Planned', 'capacity_kg' => 10, 'max_orders' => 20, 'total_load_kg' => 6]);
        foreach ([$first, $second] as $order) {
            $order->update(['delivery_run_id' => $run->id, 'delivery_status' => 'Scheduled', 'delivery_sequence' => $order->id]);
        }
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $this->postJson('/api/staff/delivery-runs/'.$run->id.'/start')->assertOk();
        $this->postJson('/api/staff/delivery-runs/'.$run->id.'/start')->assertUnprocessable();
        foreach ([$a, $b] as $customer) {
            $this->assertEquals(2, $customer->notifications()->count());
            $this->assertEquals(1, $customer->notifications()->get()->filter(fn ($notice) => $notice->data['event'] === 'departed')->count());
        }
    }

    public function test_payment_and_requested_times_are_recorded_without_duplicate_noop_updates(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 3)->setTime(12, 0));
        $customer = User::factory()->create(['role' => 'customer']);
        $order = $this->order($customer);
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $this->putJson('/api/staff/orders/'.$order->id.'/payment', ['payment_status' => 'Paid', 'payment_method' => 'Cash'])->assertOk();
        $this->putJson('/api/staff/orders/'.$order->id.'/payment', ['payment_status' => 'Paid', 'payment_method' => 'Cash'])->assertOk();
        $times = ['pickup_requested_at' => null, 'delivery_requested_at' => '2026-10-05T15:30:00+08:00'];
        $this->putJson('/api/staff/orders/'.$order->id.'/requested-times', $times)->assertOk();
        $this->putJson('/api/staff/orders/'.$order->id.'/requested-times', $times)->assertOk();
        $events = $customer->notifications()->get()->map(fn ($notice) => $notice->data['event']);
        $this->assertEqualsCanonicalizing(['booked', 'payment', 'requested_times'], $events->all());
    }

    public function test_weighing_notifies_once_with_saved_values_and_preserves_history(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $order = $this->order($customer);

        $order->update(['weight' => 4, 'total_amount' => 140]);
        $notice = $customer->notifications()->get()->firstWhere('data.event', 'weighing');
        $this->assertNotNull($notice);
        $this->assertSame('4.00', $notice->data['weight']);
        $this->assertSame('140.00', $notice->data['total_amount']);
        $this->assertStringContainsString('4.00 kg', $notice->data['message']);
        $this->assertStringContainsString('₱140.00', $notice->data['message']);
        $order->update(['weight' => 4, 'total_amount' => 140]);
        $this->assertSame(2, $customer->notifications()->count());

        $order->update(['weight' => 5, 'total_amount' => 175]);
        $this->assertSame('140.00', $notice->fresh()->data['total_amount']);
        $this->assertSame(3, $customer->notifications()->count());
    }

    public function test_schedule_notice_identifies_old_and_new_philippine_times_and_cleared_time(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $order = $this->order($customer);
        $order->update(['delivery_requested_at' => '2026-10-22 08:00:00']);

        $order->update(['delivery_requested_at' => '2026-10-22 09:00:00']);
        $notice = $customer->notifications()->get()->first(fn ($notice) => str_contains($notice->data['message'], '5:00 PM'));
        $this->assertNotNull($notice);
        $this->assertStringContainsString('Requested delivery: Oct 22, 2026, 4:00 PM PHT → Oct 22, 2026, 5:00 PM PHT', $notice->data['message']);
        $this->assertStringContainsString('not your approval', $notice->data['message']);

        $order->update(['delivery_requested_at' => null]);
        $this->assertTrue($customer->notifications()->get()->contains(fn ($notice) => str_contains($notice->data['message'], '5:00 PM PHT → Not set')));
        $this->assertStringContainsString('4:00 PM PHT → Oct 22, 2026, 5:00 PM PHT', $notice->fresh()->data['message']);
    }

    public function test_weighing_notice_uses_private_live_refresh_and_rolls_back_on_failure(): void
    {
        config(['services.order_updates.live_enabled' => true]);
        $customer = User::factory()->create(['role' => 'customer']);
        $other = User::factory()->create(['role' => 'customer']);
        $order = $this->order($customer);
        $jobsBefore = DB::table('jobs')->count();

        DB::beginTransaction();
        try {
            $order->update(['weight' => 4, 'total_amount' => 140]);
            $this->assertSame($jobsBefore + 1, DB::table('jobs')->count());
            $this->assertSame(2, $customer->notifications()->count());
            Sanctum::actingAs($other);
            $this->getJson('/api/customer/notifications')->assertOk()->assertJsonCount(0, 'notifications');
        } finally {
            DB::rollBack();
        }

        $this->assertSame($jobsBefore, DB::table('jobs')->count());
        $this->assertSame(1, $customer->notifications()->count());
        $this->assertSame('3.00', $order->fresh()->weight);
    }

    public function test_rejected_past_schedule_does_not_notify_but_saved_future_schedule_does(): void
    {
        $this->travelTo(Carbon::parse('2026-10-22T00:45:00+08:00'));
        $customer = User::factory()->create(['role' => 'customer']);
        $order = $this->order($customer);
        $order->update(['pickup_requested_at' => '2026-10-09 01:00:00', 'delivery_requested_at' => '2026-10-09 07:00:00']);
        $before = $customer->notifications()->count();
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $times = ['pickup_requested_at' => '2026-10-09T09:00:00+08:00', 'delivery_requested_at' => '2026-10-10T16:00:00+08:00'];

        $this->putJson('/api/staff/orders/'.$order->id.'/requested-times', $times)
            ->assertUnprocessable()->assertJsonValidationErrors('delivery_requested_at');
        $this->assertSame($before, $customer->notifications()->count());
        $this->assertSame('2026-10-09 07:00:00', $order->fresh()->delivery_requested_at->format('Y-m-d H:i:s'));

        $times['delivery_requested_at'] = '2026-10-23T16:00:00+08:00';
        $this->putJson('/api/staff/orders/'.$order->id.'/requested-times', $times)->assertOk();
        $this->assertSame($before + 1, $customer->notifications()->count());
        $this->assertSame('2026-10-23 08:00:00', $order->fresh()->delivery_requested_at->format('Y-m-d H:i:s'));
        $this->assertTrue($customer->notifications()->get()->contains(fn ($notice) => str_contains($notice->data['message'], 'Oct 23, 2026, 4:00 PM PHT')));
    }

    public function test_transaction_rollback_removes_notifications_alongside_changes(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $order = $this->order($customer);
        DB::beginTransaction();
        try {
            $order->update(['status' => 'Confirmed']);
            $this->assertEquals(2, $customer->notifications()->count());
        } finally {
            DB::rollBack();
        }
        $this->assertEquals('Pending', $order->fresh()->status);
        $this->assertEquals(1, $customer->notifications()->count());
    }

    public function test_notification_history_is_paginated_with_total_unread_count(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $order = $this->order($customer);
        for ($i = 0; $i < 24; $i++) {
            $customer->notify(new OrderUpdate($order, 'status'));
        }
        Sanctum::actingAs($customer);
        $this->getJson('/api/customer/notifications')->assertOk()->assertJsonCount(20, 'notifications')->assertJsonPath('unread_count', 25)->assertJsonPath('last_page', 2);
        $this->getJson('/api/customer/notifications?page=2')->assertOk()->assertJsonCount(5, 'notifications')->assertJsonPath('current_page', 2);
    }
}
