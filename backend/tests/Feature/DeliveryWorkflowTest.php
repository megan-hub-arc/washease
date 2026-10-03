<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\DeliveryRun;
use App\Models\Order;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DeliveryWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private function readyOrder(float $weight = 3): Order
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $address = Address::create(['user_id' => $customer->id, 'address' => 'Test street']);

        return Order::create(['user_id' => $customer->id, 'address_id' => $address->id, 'order_number' => fake()->unique()->bothify('WS-########'), 'weight' => $weight, 'status' => 'Ready for Delivery', 'delivery_status' => 'Scheduled', 'delivery_sequence' => 2, 'notes' => 'Wash separately']);
    }

    private function deliveryRun(float $capacity = 10, int $maxOrders = 20): DeliveryRun
    {
        return DeliveryRun::create(['rider_id' => User::factory()->create(['role' => 'rider'])->id, 'capacity_kg' => $capacity, 'max_orders' => $maxOrders, 'total_load_kg' => 0, 'status' => 'Planned']);
    }

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
    }

    public function test_bulk_assignment_and_reassignment_preserve_sequence_and_load(): void
    {
        $a = $this->readyOrder();
        $b = $this->readyOrder(4);
        $source = $this->deliveryRun();
        $target = $this->deliveryRun();
        $this->postJson("/api/staff/delivery-runs/{$source->id}/orders", ['order_ids' => [$a->id, $b->id]])->assertOk();
        $this->assertEquals(7, $source->fresh()->total_load_kg);
        $this->postJson("/api/staff/delivery-runs/{$target->id}/orders", ['order_ids' => [$a->id]])->assertOk();
        $this->assertEquals(4, $source->fresh()->total_load_kg);
        $this->assertEquals(3, $target->fresh()->total_load_kg);
        $this->assertEquals(2, $a->fresh()->delivery_sequence);
        $this->assertDatabaseCount('delivery_assignment_events', 3);
    }

    public function test_capacity_failures_roll_back_assignments(): void
    {
        $a = $this->readyOrder(6);
        $b = $this->readyOrder(6);
        $run = $this->deliveryRun();
        $this->postJson("/api/staff/delivery-runs/{$run->id}/orders", ['order_ids' => [$a->id, $b->id]])->assertUnprocessable();
        $this->assertNull($a->fresh()->delivery_run_id);
        $limited = $this->deliveryRun(30, 1);
        $this->postJson("/api/staff/delivery-runs/{$limited->id}/orders", ['order_ids' => [$a->id, $b->id]])->assertUnprocessable();
        $this->assertDatabaseCount('delivery_assignment_events', 0);
    }

    public function test_departure_blocks_reassignment_and_duplicate_assignment(): void
    {
        $order = $this->readyOrder();
        $run = $this->deliveryRun();
        $target = $this->deliveryRun();
        $this->postJson("/api/staff/delivery-runs/{$run->id}/orders", ['order_ids' => [$order->id]])->assertOk();
        $this->postJson("/api/staff/delivery-runs/{$run->id}/orders", ['order_ids' => [$order->id]])->assertUnprocessable();
        $this->postJson("/api/staff/delivery-runs/{$run->id}/start")->assertOk();
        $this->postJson("/api/staff/delivery-runs/{$target->id}/orders", ['order_ids' => [$order->id]])->assertUnprocessable();
        $this->putJson("/api/orders/{$order->id}/status", ['status' => 'Delivered'])->assertOk();
        $this->assertEquals('Completed', $run->fresh()->status);
    }

    public function test_delivery_requires_departure_and_assigned_weight_is_locked(): void
    {
        $order = $this->readyOrder();
        $run = $this->deliveryRun();
        $this->putJson("/api/orders/{$order->id}/status", ['status' => 'Delivered'])->assertUnprocessable();
        $this->postJson("/api/staff/delivery-runs/{$run->id}/orders", ['order_ids' => [$order->id]])->assertOk();
        $this->putJson("/api/staff/orders/{$order->id}/weight", ['weight' => 100])->assertUnprocessable();
    }

    public function test_customer_cannot_assign_runs(): void
    {
        $run = $this->deliveryRun();
        $order = $this->readyOrder();
        Sanctum::actingAs(User::factory()->create(['role' => 'customer']));
        $this->postJson("/api/staff/delivery-runs/{$run->id}/orders", ['order_ids' => [$order->id]])->assertForbidden();
        $this->getJson('/api/staff/delivery-runs')->assertForbidden();
    }

    public function test_booking_preference_is_preserved_when_actual_collection_differs(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $address = Address::create(['user_id' => $customer->id, 'address' => 'Home']);
        $service = Service::create(['name' => 'Wash', 'rate' => 35, 'pricing_type' => 'per_kg', 'is_active' => true]);
        Sanctum::actingAs($customer);
        $response = $this->postJson('/api/orders', ['address_id' => $address->id, 'service_id' => $service->id, 'payment_preference' => 'GCash']);
        $response->assertCreated()->assertJsonPath('order.payment_preference', 'GCash');
        $id = $response->json('order.id');
        $this->assertDatabaseHas('orders', ['id' => $id, 'payment_status' => 'Unpaid', 'payment_method' => null]);
        $this->putJson("/api/staff/orders/{$id}/payment", ['payment_status' => 'Paid', 'payment_method' => 'Cash'])->assertForbidden();
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $this->putJson("/api/staff/orders/{$id}/payment", ['payment_status' => 'Paid', 'payment_method' => 'Cash'])->assertOk()->assertJsonPath('order.payment_preference', 'GCash')->assertJsonPath('order.payment_method', 'Cash');
    }

    public function test_atomic_run_creation_does_not_leave_empty_run_after_failure(): void
    {
        $order = $this->readyOrder(5);
        $rider = User::factory()->create(['role' => 'rider']);
        $this->postJson('/api/staff/delivery-runs', ['rider_id' => $rider->id, 'capacity_kg' => 2, 'max_orders' => 20, 'order_ids' => [$order->id]])->assertUnprocessable();
        $this->assertDatabaseCount('delivery_runs', 0);
    }

    public function test_failed_reassignment_preserves_both_runs(): void
    {
        $order = $this->readyOrder(5);
        $source = $this->deliveryRun();
        $target = $this->deliveryRun(2);
        $this->postJson("/api/staff/delivery-runs/{$source->id}/orders", ['order_ids' => [$order->id]])->assertOk();
        $this->postJson("/api/staff/delivery-runs/{$target->id}/orders", ['order_ids' => [$order->id]])->assertUnprocessable();
        $this->assertEquals($source->id, $order->fresh()->delivery_run_id);
        $this->assertEquals(5, $source->fresh()->total_load_kg);
        $this->assertEquals(0, $target->fresh()->total_load_kg);
    }

    public function test_staff_order_details_include_instructions_and_rider(): void
    {
        $order = $this->readyOrder();
        $run = $this->deliveryRun();
        $this->postJson("/api/staff/delivery-runs/{$run->id}/orders", ['order_ids' => [$order->id]])->assertOk();
        $this->getJson('/api/staff/orders')->assertOk()->assertJsonPath('0.notes', 'Wash separately')->assertJsonPath('0.delivery_run.rider.id', $run->rider_id);
    }

    public function test_unscheduled_and_weightless_orders_cannot_be_assigned(): void
    {
        $order = $this->readyOrder(0);
        $run = $this->deliveryRun();
        $this->postJson("/api/staff/delivery-runs/{$run->id}/orders", ['order_ids' => [$order->id]])->assertUnprocessable();
        $order->update(['weight' => 3, 'delivery_status' => 'Unscheduled']);
        $this->postJson("/api/staff/delivery-runs/{$run->id}/orders", ['order_ids' => [$order->id]])->assertUnprocessable();
        $this->postJson("/api/staff/delivery-runs/{$run->id}/start")->assertUnprocessable();
    }

    public function test_rider_is_unavailable_until_staff_confirms_return_without_changing_payment(): void
    {
        $order = $this->readyOrder();
        $first = $this->deliveryRun();
        $second = $this->deliveryRun();
        $second->update(['rider_id' => $first->rider_id]);
        $nextOrder = $this->readyOrder();
        $this->postJson("/api/staff/delivery-runs/{$first->id}/orders", ['order_ids' => [$order->id]])->assertOk();
        $this->postJson("/api/staff/delivery-runs/{$second->id}/orders", ['order_ids' => [$nextOrder->id]])->assertOk();
        $this->postJson("/api/staff/delivery-runs/{$first->id}/start")->assertOk();
        $this->postJson("/api/staff/delivery-runs/{$second->id}/start")->assertUnprocessable();
        $this->postJson("/api/staff/delivery-runs/{$first->id}/return")->assertUnprocessable();
        $this->putJson("/api/orders/{$order->id}/status", ['status' => 'Delivered'])->assertOk();
        $this->postJson("/api/staff/delivery-runs/{$second->id}/start")->assertUnprocessable();
        $rider = collect($this->getJson('/api/staff/riders')->assertOk()->json())->firstWhere('id', $first->rider_id);
        $this->assertEquals('Awaiting return', $rider['availability']);
        $this->postJson("/api/staff/delivery-runs/{$first->id}/return")->assertOk();
        $this->assertNotNull($first->fresh()->returned_at);
        $this->assertEquals('Unpaid', $order->fresh()->payment_status);
        $this->postJson("/api/staff/delivery-runs/{$first->id}/return")->assertUnprocessable();
        $this->postJson("/api/staff/delivery-runs/{$second->id}/start")->assertOk();
    }

    public function test_returned_rider_can_be_assigned_two_remaining_orders_in_a_new_run(): void
    {
        $first = $this->deliveryRun();
        $delivered = $this->readyOrder();
        $remaining = [$this->readyOrder(4), $this->readyOrder(5)];
        $this->postJson("/api/staff/delivery-runs/{$first->id}/orders", ['order_ids' => [$delivered->id]])->assertOk();
        $this->postJson("/api/staff/delivery-runs/{$first->id}/start")->assertOk();
        $this->putJson("/api/orders/{$delivered->id}/status", ['status' => 'Delivered'])->assertOk();
        $this->postJson("/api/staff/delivery-runs/{$first->id}/return")->assertOk();
        $rider = collect($this->getJson('/api/staff/riders')->assertOk()->json())->firstWhere('id', $first->rider_id);
        $this->assertEquals('Available', $rider['availability']);
        $response = $this->postJson('/api/staff/delivery-runs', [
            'rider_id' => $first->rider_id, 'capacity_kg' => 10, 'max_orders' => 20,
            'order_ids' => array_map(fn (Order $order) => $order->id, $remaining),
        ])->assertCreated();
        $nextId = $response->json('delivery_run.id');
        $this->assertCount(2, $response->json('delivery_run.orders'));
        $this->assertEquals(9, $response->json('delivery_run.total_load_kg'));
        $this->postJson("/api/staff/delivery-runs/{$nextId}/start")->assertOk();
        $this->assertEquals('Completed', $first->fresh()->status);
        $this->assertEquals('Delivered', $delivered->fresh()->status);
    }

    public function test_off_duty_rider_cannot_depart_and_customer_cannot_confirm_return(): void
    {
        $run = $this->deliveryRun();
        $order = $this->readyOrder();
        $this->postJson("/api/staff/delivery-runs/{$run->id}/orders", ['order_ids' => [$order->id]])->assertOk();
        $this->putJson("/api/staff/riders/{$run->rider_id}/duty", ['rider_on_duty' => false])->assertOk();
        $this->postJson("/api/staff/delivery-runs/{$run->id}/start")->assertUnprocessable();
        $this->putJson("/api/staff/riders/{$run->rider_id}/duty", ['rider_on_duty' => true])->assertOk();
        $this->postJson("/api/staff/delivery-runs/{$run->id}/start")->assertOk();
        Sanctum::actingAs(User::factory()->create(['role' => 'customer']));
        $this->postJson("/api/staff/delivery-runs/{$run->id}/return")->assertForbidden();
        $this->putJson("/api/staff/riders/{$run->rider_id}/duty", ['rider_on_duty' => false])->assertForbidden();
    }
}
