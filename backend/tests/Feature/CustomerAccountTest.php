<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerAccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_updates_contact_but_cannot_change_role_or_use_another_email(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $other = User::factory()->create();
        Sanctum::actingAs($customer);
        $this->putJson('/api/customer/profile', ['name' => 'Updated', 'email' => $other->email])->assertUnprocessable();
        $this->putJson('/api/customer/profile', ['name' => 'Updated', 'email' => 'updated@example.com', 'phone' => '09123456789', 'role' => 'admin'])->assertOk()->assertJsonPath('user.role', 'customer');
        $this->assertEquals('updated@example.com', $customer->fresh()->email);
        $this->assertEquals('09123456789', $customer->fresh()->phone);
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $this->putJson('/api/customer/profile', ['name' => 'Staff', 'email' => 'staff@example.com'])->assertForbidden();
    }

    public function test_address_edit_preserves_original_order_location_and_zone_and_blocks_old_address_booking(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($customer);
        $zone = DeliveryZone::create(['name' => 'Original zone', 'priority_order' => 1, 'is_active' => true]);
        $address = Address::create(['user_id' => $customer->id, 'label' => 'Home', 'address' => 'Original street', 'delivery_zone_id' => $zone->id, 'notes' => 'Original instructions']);
        $service = Service::create(['name' => 'Laundry', 'pricing_type' => 'fixed', 'rate' => 100, 'is_active' => true]);
        $orderId = $this->postJson('/api/orders', ['address_id' => $address->id, 'service_id' => $service->id, 'payment_preference' => 'Cash'])->assertCreated()->json('order.id');
        $response = $this->putJson('/api/addresses/'.$address->id, ['label' => 'Home', 'address' => 'New street', 'notes' => 'New instructions'])->assertOk();
        $newId = $response->json('address.id');
        $this->assertNotEquals($address->id, $newId);
        $response->assertJsonPath('address.delivery_zone_id', null);
        $this->assertEquals($address->id, Order::findOrFail($orderId)->address_id);
        $this->assertEquals('Original street', $address->fresh()->address);
        $this->assertEquals('Original instructions', $address->fresh()->notes);
        $this->assertEquals($zone->id, $address->fresh()->delivery_zone_id);
        $this->getJson('/api/addresses')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $newId);
        $this->postJson('/api/orders', ['address_id' => $address->id, 'service_id' => $service->id, 'payment_preference' => 'Cash'])->assertNotFound();
        $this->postJson('/api/orders', ['address_id' => $newId, 'service_id' => $service->id, 'payment_preference' => 'Cash'])->assertCreated();
    }

    public function test_remove_used_address_keeps_orders_and_unused_address_is_deleted_with_ownership_enforced(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $address = Address::create(['user_id' => $customer->id, 'address' => 'Used street']);
        $unused = Address::create(['user_id' => $customer->id, 'address' => 'Unused street']);
        $order = Order::create(['user_id' => $customer->id, 'address_id' => $address->id, 'order_number' => 'WS-ACCOUNT']);
        Sanctum::actingAs(User::factory()->create(['role' => 'customer']));
        $this->putJson('/api/addresses/'.$address->id, ['address' => 'Unauthorized'])->assertNotFound();
        $this->deleteJson('/api/addresses/'.$address->id)->assertNotFound();
        Sanctum::actingAs($customer);
        $this->deleteJson('/api/addresses/'.$address->id)->assertOk();
        $this->assertNotNull($address->fresh()->archived_at);
        $this->assertEquals('Used street', $order->fresh()->address->address);
        $this->deleteJson('/api/addresses/'.$unused->id)->assertOk();
        $this->assertDatabaseMissing('addresses', ['id' => $unused->id]);
        $this->getJson('/api/addresses')->assertOk()->assertJsonCount(0);
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $this->getJson('/api/staff/addresses')->assertOk()->assertJsonCount(1);
        $order->update(['status' => 'Delivered']);
        $this->getJson('/api/staff/addresses')->assertOk()->assertJsonCount(0);
        Sanctum::actingAs($customer);
        $this->putJson('/api/addresses/'.$address->id, ['address' => 'Archived'])->assertNotFound();
    }

    public function test_unused_address_edit_reuses_id_and_instruction_only_edit_preserves_zone(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($customer);
        $zone = DeliveryZone::create(['name' => 'Zone', 'priority_order' => 1, 'is_active' => true]);
        $address = Address::create(['user_id' => $customer->id, 'address' => 'Street', 'delivery_zone_id' => $zone->id]);
        $this->putJson('/api/addresses/'.$address->id, ['address' => 'Street', 'notes' => 'Meet at gate'])->assertOk()->assertJsonPath('address.id', $address->id)->assertJsonPath('address.delivery_zone_id', $zone->id);
        $this->putJson('/api/addresses/'.$address->id, ['address' => 'Changed street'])->assertOk()->assertJsonPath('address.id', $address->id)->assertJsonPath('address.delivery_zone_id', null);
    }
}
