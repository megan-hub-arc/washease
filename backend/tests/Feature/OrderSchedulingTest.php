<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\DeliveryRun;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Service;
use App\Models\User;
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
        $this->putJson($path, $payload)->assertOk()->assertJsonPath('order.delivery_status', 'Unscheduled')->assertJsonPath('order.delivery_sequence', null);
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
}
