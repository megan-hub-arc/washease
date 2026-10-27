<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\DeliveryRun;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Service;
use App\Models\User;
use App\Services\ZtlpaScheduler;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderSchedulingTest extends TestCase
{
    use RefreshDatabase;

    private function readyOrder(DeliveryZone $zone, ?string $time, float $weight = 3): Order
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $address = Address::create(['user_id' => $customer->id, 'address' => 'Street', 'delivery_zone_id' => $zone->id]);

        return Order::create(['user_id' => $customer->id, 'address_id' => $address->id, 'order_number' => fake()->unique()->bothify('WS-########'), 'status' => 'Ready for Delivery', 'weight' => $weight, 'delivery_requested_at' => $time]);
    }

    public function test_zone_time_load_and_exact_ties_have_stable_priority_without_using_booking_time(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $first = DeliveryZone::create(['name' => 'First', 'priority_order' => 1, 'is_active' => true]);
        $second = DeliveryZone::create(['name' => 'Second', 'priority_order' => 2, 'is_active' => true]);
        $late = $this->readyOrder($first, '2026-10-05 10:00:00', 9);
        $light = $this->readyOrder($first, '2026-10-05 09:00:00', 2);
        $heavy = $this->readyOrder($first, '2026-10-05 09:00:00', 6);
        $tie = $this->readyOrder($first, '2026-10-05 09:00:00', 6);
        $noTime = $this->readyOrder($first, null, 20);
        $other = $this->readyOrder($second, '2026-10-04 09:00:00', 10);
        $noTime->update(['requested_at' => '2026-01-01 00:00:00']);
        $response = $this->postJson('/api/staff/orders/schedule')->assertOk();
        $this->assertEquals([$heavy->id, $tie->id, $light->id, $late->id, $noTime->id, $other->id], array_column($response->json('orders'), 'id'));
        $this->assertEquals([1, 2, 3, 4, 5, 6], array_column($response->json('orders'), 'delivery_sequence'));
        $this->assertNotNull($heavy->fresh()->scheduled_at);
        $this->assertEquals(array_column($response->json('orders'), 'id'), array_column($this->postJson('/api/staff/orders/schedule')->assertOk()->json('orders'), 'id'));
    }

    public function test_equal_priority_zones_remain_grouped_and_invalid_orders_are_not_scheduled(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $a = DeliveryZone::create(['name' => 'A', 'priority_order' => 1, 'is_active' => true]);
        $b = DeliveryZone::create(['name' => 'B', 'priority_order' => 1, 'is_active' => true]);
        $inactive = DeliveryZone::create(['name' => 'Inactive', 'priority_order' => 1, 'is_active' => false]);
        $first = $this->readyOrder($a, '2026-10-05 10:00:00');
        $second = $this->readyOrder($a, '2026-10-05 11:00:00');
        $third = $this->readyOrder($b, '2026-10-05 09:00:00');
        $bad = $this->readyOrder($inactive, null);
        $bad->update(['delivery_status' => 'Scheduled', 'delivery_sequence' => 4]);
        $zero = $this->readyOrder($a, null, 0);
        $missing = $this->readyOrder($a, null);
        $missing->address->update(['delivery_zone_id' => null]);
        $notReady = $this->readyOrder($a, null);
        $notReady->update(['status' => 'Processing']);
        $response = $this->postJson('/api/staff/orders/schedule')->assertOk();
        $this->assertEquals([$first->id, $second->id, $third->id], array_column($response->json('orders'), 'id'));
        foreach ([$bad, $zero, $missing, $notReady] as $order) {
            $this->assertEquals('Unscheduled', $order->fresh()->delivery_status);
            $this->assertNull($order->fresh()->delivery_sequence);
        }
    }

    public function test_queue_rebuild_includes_new_orders_without_reordering_assigned_runs(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $zone = DeliveryZone::create(['name' => 'Zone', 'priority_order' => 1, 'is_active' => true]);
        $assigned = $this->readyOrder($zone, null);
        $run = DeliveryRun::create(['rider_id' => User::factory()->create(['role' => 'rider'])->id, 'status' => 'Planned', 'capacity_kg' => 10, 'max_orders' => 20, 'total_load_kg' => 3]);
        $assigned->update(['delivery_status' => 'Scheduled', 'delivery_sequence' => 1, 'delivery_run_id' => $run->id]);
        $old = $this->readyOrder($zone, '2026-10-05 11:00:00');
        $this->postJson('/api/staff/orders/schedule')->assertOk();
        $new = $this->readyOrder($zone, '2026-10-05 09:00:00');
        $this->postJson('/api/staff/orders/schedule')->assertOk();
        $this->assertEquals(1, $assigned->fresh()->delivery_sequence);
        $this->assertEquals($run->id, $assigned->fresh()->delivery_run_id);
        $this->assertEquals(2, $new->fresh()->delivery_sequence);
        $this->assertEquals(3, $old->fresh()->delivery_sequence);
        $this->assertEquals(3, $run->fresh()->total_load_kg);
    }

    public function test_booking_keeps_distinct_times_and_normalizes_timezone_with_future_and_order_validation(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 3)->setTime(12, 0));
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($customer);
        $address = Address::create(['user_id' => $customer->id, 'address' => 'Street']);
        $service = Service::create(['name' => 'Laundry', 'pricing_type' => 'per_kg', 'rate' => 50, 'is_active' => true]);
        $payload = ['address_id' => $address->id, 'service_id' => $service->id, 'payment_preference' => 'Cash', 'pickup_requested_at' => '2026-10-04T09:00:00+08:00', 'delivery_requested_at' => '2026-10-05T15:30:00+08:00'];
        $response = $this->postJson('/api/orders', $payload)->assertCreated();
        $order = Order::findOrFail($response->json('order.id'));
        $this->assertEquals('2026-10-04 01:00:00', $order->pickup_requested_at->format('Y-m-d H:i:s'));
        $this->assertEquals('2026-10-05 07:30:00', $order->delivery_requested_at->format('Y-m-d H:i:s'));
        $this->assertEquals('2026-10-03 12:00:00', $order->requested_at->format('Y-m-d H:i:s'));
        $payload['delivery_requested_at'] = '2026-10-04T08:00:00+08:00';
        $this->postJson('/api/orders', $payload)->assertUnprocessable()->assertJsonValidationErrors('delivery_requested_at');
        $payload['delivery_requested_at'] = '2026-10-01T08:00:00+08:00';
        $this->postJson('/api/orders', $payload)->assertUnprocessable();
        $payload['delivery_requested_at'] = '2026-10-05T15:30';
        $this->postJson('/api/orders', $payload)->assertUnprocessable();
        $payload['pickup_requested_at'] = null;
        $payload['delivery_requested_at'] = null;
        $this->postJson('/api/orders', $payload)->assertCreated()->assertJsonPath('order.delivery_requested_at', null);
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $payload['delivery_requested_at'] = '2026-10-05T15:30:00+08:00';
        $this->postJson('/api/staff/customers/'.$customer->id.'/orders', $payload)->assertCreated();
        $this->assertDatabaseCount('orders', 3);
    }

    public function test_only_staff_can_change_requested_times_and_assigned_or_delivered_orders_are_locked(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 3)->setTime(12, 0));
        $zone = DeliveryZone::create(['name' => 'Zone', 'priority_order' => 1, 'is_active' => true]);
        $order = $this->readyOrder($zone, null);
        $payload = ['pickup_requested_at' => null, 'delivery_requested_at' => '2026-10-05T15:30:00+08:00'];
        $path = '/api/staff/orders/'.$order->id.'/requested-times';
        Sanctum::actingAs(User::findOrFail($order->user_id));
        $this->putJson($path, $payload)->assertForbidden();
        $this->postJson('/api/staff/orders/schedule')->assertForbidden();
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $order->update(['delivery_status' => 'Scheduled', 'delivery_sequence' => 2]);
        $this->putJson($path, $payload)->assertOk()->assertJsonPath('order.delivery_status', 'Scheduled')->assertJsonPath('order.delivery_sequence', 1);
        $this->putJson($path, [])->assertUnprocessable();
        $order->update(['pickup_requested_at' => '2026-10-02 01:00:00']);
        $payload['pickup_requested_at'] = '2026-10-02T09:00:00+08:00';
        $this->putJson($path, $payload)->assertOk();
        $invalid = $payload;
        $invalid['pickup_requested_at'] = '2026-10-01T09:00:00+08:00';
        $this->putJson($path, $invalid)->assertUnprocessable()->assertJsonValidationErrors('pickup_requested_at');
        $run = DeliveryRun::create(['rider_id' => User::factory()->create(['role' => 'rider'])->id, 'status' => 'Planned', 'capacity_kg' => 10, 'max_orders' => 20, 'total_load_kg' => 3]);
        $order->update(['delivery_run_id' => $run->id]);
        $this->putJson($path, $payload)->assertUnprocessable();
        $order->update(['delivery_run_id' => null, 'status' => 'Delivered']);
        $this->putJson($path, $payload)->assertUnprocessable();
    }

    public function test_ready_transition_requires_weight_and_active_zone_without_changing_status_on_failure(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $zone = DeliveryZone::create(['name' => 'Readiness test', 'priority_order' => 1, 'is_active' => true]);
        $order = $this->readyOrder($zone, null, 0);
        $order->update(['status' => 'Processing']);
        $this->putJson("/api/orders/{$order->id}/status", ['status' => 'Ready for Delivery'])->assertUnprocessable();
        $this->assertEquals('Processing', $order->fresh()->status);
        $order->update(['weight' => 3]);
        $zone->update(['is_active' => false]);
        $this->putJson("/api/orders/{$order->id}/status", ['status' => 'Ready for Delivery'])->assertUnprocessable();
        $order->address->update(['delivery_zone_id' => null]);
        $this->putJson("/api/orders/{$order->id}/status", ['status' => 'Ready for Delivery'])->assertUnprocessable();
        $order->address->update(['delivery_zone_id' => $zone->id]);
        $zone->update(['is_active' => true]);
        $this->putJson("/api/orders/{$order->id}/status", ['status' => 'Ready for Delivery'])->assertOk();
    }

    public function test_payment_cannot_lock_an_unweighed_order_and_existing_bad_payment_can_be_corrected(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $zone = DeliveryZone::create(['name' => 'Payment test', 'priority_order' => 1, 'is_active' => true]);
        $order = $this->readyOrder($zone, null, 0);
        $this->putJson("/api/staff/orders/{$order->id}/payment", ['payment_status' => 'Paid', 'payment_method' => 'Cash'])->assertUnprocessable();
        $this->assertEquals('Unpaid', $order->fresh()->payment_status);
        $order->update(['payment_status' => 'Paid']);
        $this->putJson("/api/staff/orders/{$order->id}/payment", ['payment_status' => 'Unpaid'])->assertOk();
        $order->update(['weight' => 3]);
        $this->putJson("/api/staff/orders/{$order->id}/payment", ['payment_status' => 'Paid', 'payment_method' => 'Cash'])->assertOk();
    }

    public function test_marking_ready_automatically_prioritizes_without_schedule_request(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $zone = DeliveryZone::create(['name' => 'Automatic', 'priority_order' => 1, 'is_active' => true]);
        $late = $this->readyOrder($zone, '2026-10-29 10:00:00');
        $late->update(['status' => 'Processing']);
        $early = $this->readyOrder($zone, '2026-10-29 09:00:00');
        $early->update(['status' => 'Processing']);
        $this->putJson("/api/orders/{$late->id}/status", ['status' => 'Ready for Delivery'])->assertOk()->assertJsonPath('order.delivery_status', 'Scheduled')->assertJsonPath('order.delivery_sequence', 1);
        $this->putJson("/api/orders/{$early->id}/status", ['status' => 'Ready for Delivery'])->assertOk()->assertJsonPath('order.delivery_sequence', 1);
        $this->assertEquals(2, $late->fresh()->delivery_sequence);
    }

    public function test_weight_change_reorders_free_queue_and_does_not_change_assigned_run(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $zone = DeliveryZone::create(['name' => 'Weight queue', 'priority_order' => 1, 'is_active' => true]);
        $assigned = $this->readyOrder($zone, null, 3);
        $run = DeliveryRun::create(['rider_id' => User::factory()->create(['role' => 'rider'])->id, 'status' => 'Started', 'capacity_kg' => 20, 'max_orders' => 20, 'total_load_kg' => 3]);
        $assigned->update(['delivery_run_id' => $run->id, 'delivery_sequence' => 4, 'delivery_status' => 'Scheduled']);
        $light = $this->readyOrder($zone, null, 2);
        $heavy = $this->readyOrder($zone, null, 6);
        $service = Service::create(['name' => 'Automatic wash', 'rate' => 35, 'pricing_type' => 'per_kg', 'is_active' => true]);
        $light->update(['service_id' => $service->id]);
        $this->putJson("/api/staff/orders/{$light->id}/weight", ['weight' => 8])->assertOk()->assertJsonPath('order.delivery_sequence', 5);
        $this->assertEquals(6, $heavy->fresh()->delivery_sequence);
        $this->assertEquals(4, $assigned->fresh()->delivery_sequence);
        $this->assertEquals(3, $run->fresh()->total_load_kg);
        $this->assertEquals($run->id, $assigned->fresh()->delivery_run_id);
        $this->assertEquals(280, $light->fresh()->total_amount);
    }

    public function test_requested_delivery_change_reprioritizes_without_extra_customer_notices(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 27)->setTime(8, 0));
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $zone = DeliveryZone::create(['name' => 'Time queue', 'priority_order' => 1, 'is_active' => true]);
        $first = $this->readyOrder($zone, '2026-10-29 09:00:00');
        $second = $this->readyOrder($zone, '2026-10-29 10:00:00');
        $before = $second->user->notifications()->count();
        $this->putJson("/api/staff/orders/{$second->id}/requested-times", ['pickup_requested_at' => null, 'delivery_requested_at' => '2026-10-29T16:00:00+08:00'])->assertOk()->assertJsonPath('order.delivery_sequence', 1);
        $this->assertEquals(2, $first->fresh()->delivery_sequence);
        $this->assertEquals($before + 1, $second->user->notifications()->count());
    }

    public function test_zone_changes_automatically_update_free_queue_and_preserve_assigned_sequence(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $a = DeliveryZone::create(['name' => 'A queue', 'priority_order' => 1, 'is_active' => true]);
        $b = DeliveryZone::create(['name' => 'B queue', 'priority_order' => 2, 'is_active' => true]);
        $first = $this->readyOrder($a, null);
        $second = $this->readyOrder($b, null);
        $assigned = $this->readyOrder($a, null);
        $run = DeliveryRun::create(['rider_id' => User::factory()->create(['role' => 'rider'])->id, 'status' => 'Started', 'capacity_kg' => 20, 'max_orders' => 20, 'total_load_kg' => 3]);
        $assigned->update(['delivery_run_id' => $run->id, 'delivery_sequence' => 1, 'delivery_status' => 'Scheduled']);
        $this->putJson("/api/staff/delivery-zones/{$b->id}", ['priority_order' => 1])->assertOk();
        $this->putJson("/api/staff/delivery-zones/{$a->id}", ['priority_order' => 3])->assertOk();
        $this->assertEquals(2, $second->fresh()->delivery_sequence);
        $this->assertEquals(3, $first->fresh()->delivery_sequence);
        $this->putJson("/api/staff/delivery-zones/{$b->id}", ['is_active' => false])->assertOk();
        $this->assertNull($second->fresh()->delivery_sequence);
        $this->assertEquals('Unscheduled', $second->fresh()->delivery_status);
        $this->assertEquals(1, $assigned->fresh()->delivery_sequence);
        $this->putJson("/api/staff/delivery-zones/{$b->id}", ['is_active' => true])->assertOk();
        $this->assertEquals('Scheduled', $second->fresh()->delivery_status);
        $this->putJson("/api/staff/delivery-zones/{$b->id}", ['is_active' => false])->assertOk();
        $this->putJson("/api/staff/addresses/{$second->address_id}/zone", ['delivery_zone_id' => $a->id])->assertOk();
        $this->assertEquals('Scheduled', $second->fresh()->delivery_status);
    }

    public function test_refresh_keeps_unchanged_schedule_time_and_customer_notification_count(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $zone = DeliveryZone::create(['name' => 'Stable queue', 'priority_order' => 1, 'is_active' => true]);
        $order = $this->readyOrder($zone, null);
        $this->postJson('/api/staff/orders/schedule')->assertOk();
        $scheduledAt = $order->fresh()->scheduled_at;
        $notices = $order->user->notifications()->count();
        $this->travel(1)->minutes();
        $this->postJson('/api/staff/orders/schedule')->assertOk();
        $this->assertTrue($scheduledAt->equalTo($order->fresh()->scheduled_at));
        $this->assertEquals($notices, $order->user->notifications()->count());
    }

    public function test_rejected_change_and_transaction_rollback_preserve_queue_and_notices(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $zone = DeliveryZone::create(['name' => 'Rollback queue', 'priority_order' => 1, 'is_active' => true]);
        $order = $this->readyOrder($zone, null);
        $this->postJson('/api/staff/orders/schedule')->assertOk();
        $sequence = $order->fresh()->delivery_sequence;
        $notices = $order->user->notifications()->count();
        $this->putJson("/api/staff/orders/{$order->id}/weight", ['weight' => 0])->assertUnprocessable();
        try {
            app(ZtlpaScheduler::class)->synchronize(function () use ($order): void {
                $order->update(['weight' => 7]);
                throw new \RuntimeException('Rollback scheduling input');
            });
            $this->fail('The transaction should throw.');
        } catch (\RuntimeException $exception) {
            $this->assertEquals('Rollback scheduling input', $exception->getMessage());
        }
        $this->assertEquals(3, $order->fresh()->weight);
        $this->assertEquals($sequence, $order->fresh()->delivery_sequence);
        $this->assertEquals($notices, $order->user->notifications()->count());
    }
}
