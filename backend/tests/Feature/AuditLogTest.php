<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\AuditLog;
use App\Models\DeliveryRun;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use LogicException;
use RuntimeException;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    private function order(string $status = 'Pending', float $weight = 3): Order
    {
        $customer = User::factory()->create(['role' => 'customer']);

        $zone = DeliveryZone::create([
            'name' => fake()->unique()->bothify('Zone-####'),
            'priority_order' => 1,
            'is_active' => true,
        ]);

        $address = Address::create([
            'user_id' => $customer->id,
            'address' => 'Private customer address',
            'delivery_zone_id' => $zone->id,
        ]);

        return Order::create([
            'user_id' => $customer->id,
            'address_id' => $address->id,
            'order_number' => fake()->unique()->bothify('WS-########'),
            'status' => $status,
            'weight' => $weight,
            'total_amount' => 105,
            'notes' => 'PRIVATE-NOTES',
            'delivery_status' => 'Scheduled',
            'delivery_sequence' => 1,
        ]);
    }

    private function deliveryRun(): DeliveryRun
    {
        $rider = User::factory()->create([
            'role' => 'rider',
            'rider_on_duty' => true,
        ]);

        return DeliveryRun::create([
            'rider_id' => $rider->id,
            'capacity_kg' => 10,
            'max_orders' => 20,
            'total_load_kg' => 0,
            'status' => 'Planned',
        ]);
    }

    public function test_status_and_payment_logs_record_actual_actor_and_changed_values_without_private_payloads(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);
        Sanctum::actingAs($staff);

        $order = $this->order();

        $this->putJson("/api/orders/{$order->id}/status", [
            'status' => 'Confirmed',
            'actor_user_id' => 999999,
            'actor_name' => 'Forged',
        ])->assertOk();

        $status = AuditLog::where('action', 'order_status')->sole();

        $this->assertEquals($staff->id, $status->actor_user_id);
        $this->assertEquals($staff->name, $status->actor_name);
        $this->assertSame(['status' => 'Pending'], $status->before_values);
        $this->assertSame(['status' => 'Confirmed'], $status->after_values);
        $this->assertEquals($order->id, $status->subject_id);
        $this->assertNotNull($status->created_at);

        $this->putJson("/api/staff/orders/{$order->id}/payment", [
            'payment_status' => 'Paid',
            'payment_method' => 'Cash',
        ])->assertOk();

        $payment = AuditLog::where('action', 'order_payment')->sole();

        $this->assertSame('Unpaid', $payment->before_values['payment_status']);
        $this->assertSame('Paid', $payment->after_values['payment_status']);
        $this->assertSame('Cash', $payment->after_values['payment_method']);
        $this->assertNotEmpty($payment->after_values['paid_at']);

        $body = $this->getJson('/api/staff/audit-logs')
            ->assertOk()
            ->assertJsonPath('total', 2)
            ->getContent();

        $this->assertStringNotContainsString('PRIVATE-NOTES', $body);
        $this->assertStringNotContainsString('Private customer address', $body);
        $this->assertStringNotContainsString($order->user->email, $body);
        $this->assertStringNotContainsString('password', $body);
    }

    public function test_assignment_reassignment_departure_and_return_are_recorded(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $order = $this->order('Ready for Delivery');
        $first = $this->deliveryRun();
        $second = $this->deliveryRun();

        $this->postJson("/api/staff/delivery-runs/{$first->id}/orders", [
            'order_ids' => [$order->id],
        ])->assertOk();

        $this->postJson("/api/staff/delivery-runs/{$second->id}/orders", [
            'order_ids' => [$order->id],
        ])->assertOk();

        $logs = AuditLog::where('action', 'order_assignment')
            ->orderBy('id')
            ->get();

        $this->assertCount(2, $logs);
        $this->assertNull($logs[0]->before_values['delivery_run_id']);
        $this->assertEquals($first->id, $logs[0]->after_values['delivery_run_id']);
        $this->assertEquals($first->id, $logs[1]->before_values['delivery_run_id']);
        $this->assertEquals($second->id, $logs[1]->after_values['delivery_run_id']);

        $this->postJson("/api/staff/delivery-runs/{$second->id}/start")
            ->assertOk();

        $this->assertSame(
            'Started',
            AuditLog::where('action', 'run_status')->sole()->after_values['status']
        );

        $this->putJson("/api/orders/{$order->id}/status", [
            'status' => 'Delivered',
        ])->assertOk();

        $this->postJson("/api/staff/delivery-runs/{$second->id}/return")
            ->assertOk();

        $return = AuditLog::where('action', 'run_return')->sole();

        $this->assertNull($return->before_values['returned_at']);
        $this->assertNotEmpty($return->after_values['returned_at']);
    }

    public function test_invalid_status_capacity_and_noop_updates_produce_no_extra_entries(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));

        $order = $this->order();

        $this->putJson("/api/orders/{$order->id}/status", [
            'status' => 'Delivered',
        ])->assertUnprocessable();

        $this->assertDatabaseCount('audit_logs', 0);

        $order->update(['status' => 'Confirmed']);
        $order->update(['status' => 'Confirmed']);

        $this->assertDatabaseCount('audit_logs', 1);

        $tooHeavy = $this->order('Ready for Delivery', 11);
        $run = $this->deliveryRun();

        $this->postJson("/api/staff/delivery-runs/{$run->id}/orders", [
            'order_ids' => [$tooHeavy->id],
        ])->assertUnprocessable();

        $this->assertDatabaseCount('audit_logs', 1);
    }

    public function test_transaction_rollback_removes_both_order_change_and_its_log(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));

        $order = $this->order();

        try {
            DB::transaction(function () use ($order): void {
                $order->update(['status' => 'Confirmed']);

                $this->assertDatabaseCount('audit_logs', 1);

                throw new RuntimeException('rollback');
            });

            $this->fail('Expected rollback.');
        } catch (RuntimeException $exception) {
            $this->assertSame('rollback', $exception->getMessage());
        }

        $this->assertSame('Pending', $order->fresh()->status);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_audit_write_failure_rolls_back_the_business_change(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));

        $order = $this->order();

        AuditLog::query()->count();

        $dispatcher = AuditLog::getEventDispatcher();
        AuditLog::setEventDispatcher(clone $dispatcher);

        $this->withoutExceptionHandling();

        try {
            AuditLog::creating(function (): void {
                throw new RuntimeException('audit storage unavailable');
            });

            $this->putJson("/api/orders/{$order->id}/status", [
                'status' => 'Confirmed',
            ]);

            $this->fail('Expected audit write failure.');
        } catch (RuntimeException $exception) {
            $this->assertSame(
                'audit storage unavailable',
                $exception->getMessage()
            );
        } finally {
            AuditLog::setEventDispatcher($dispatcher);
        }

        $this->assertSame('Pending', $order->fresh()->status);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_guests_customers_and_riders_cannot_read_or_write_audit_history(): void
    {
        $this->getJson('/api/staff/audit-logs')
            ->assertUnauthorized();

        foreach (['customer', 'rider'] as $role) {
            Sanctum::actingAs(User::factory()->create(['role' => $role]));

            $this->getJson('/api/staff/audit-logs')
                ->assertForbidden();
        }

        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));

        $this->postJson('/api/staff/audit-logs', [
            'action' => 'order_status',
        ])->assertStatus(405);

        $this->putJson('/api/staff/audit-logs/1', [])
            ->assertNotFound();

        $this->deleteJson('/api/staff/audit-logs/1')
            ->assertNotFound();
    }

    public function test_history_filters_are_paginated_newest_first_and_reject_invalid_queries(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));

        $first = $this->order();
        $second = $this->order();

        $first->update(['status' => 'Confirmed']);
        $second->update(['status' => 'Confirmed']);

        $this->getJson('/api/staff/audit-logs?per_page=1')
            ->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonPath('data.0.subject_id', $second->id)
            ->assertJsonPath('last_page', 2);

        $this->getJson('/api/staff/audit-logs?per_page=1&page=2')
            ->assertOk()
            ->assertJsonPath('data.0.subject_id', $first->id);

        $this->getJson(
            '/api/staff/audit-logs?action=order_status&subject_type=order&subject_id='.$first->id
        )->assertOk()->assertJsonPath('total', 1);

        foreach ([
            'per_page=101',
            'page=0',
            'action=unknown',
            'subject_type=user',
            'subject_id=-1',
        ] as $query) {
            $this->getJson('/api/staff/audit-logs?'.$query)
                ->assertUnprocessable();
        }
    }

    public function test_customer_context_is_not_misattributed_as_a_staff_action_and_queue_refresh_is_silent(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($customer);

        $order = $this->order();
        $order->update(['status' => 'Confirmed']);

        $this->assertDatabaseCount('audit_logs', 0);

        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));

        $this->order('Ready for Delivery');

        $this->postJson('/api/staff/orders/schedule')
            ->assertOk();

        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_model_rejects_editing_and_deleting_recorded_history(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));

        $this->order()->update(['status' => 'Confirmed']);

        $entry = AuditLog::sole();

        foreach (['update', 'delete'] as $operation) {
            try {
                if ($operation === 'update') {
                    $entry->update(['actor_name' => 'Changed']);
                } else {
                    $entry->delete();
                }

                $this->fail('Expected history mutation to be rejected.');
            } catch (LogicException $exception) {
                $this->assertStringContainsString(
                    'Audit records cannot be',
                    $exception->getMessage()
                );
            }
        }

        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertNotSame('Changed', $entry->fresh()->actor_name);
    }
}
