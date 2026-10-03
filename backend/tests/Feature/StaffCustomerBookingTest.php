<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Order;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StaffCustomerBookingTest extends TestCase
{
    use RefreshDatabase;

    private function intake(): array
    {
        return ['name' => 'Counter Customer', 'phone' => '09123456789', 'password' => 'InitialPass123', 'password_confirmation' => 'InitialPass123', 'address' => '10 Test Street', 'notes' => 'Meet at gate'];
    }

    public function test_staff_registers_phone_only_customer_with_address_and_no_exposed_credentials(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $response = $this->postJson('/api/staff/customers', $this->intake() + ['role' => 'admin'])->assertCreated()->assertJsonPath('customer.role', 'customer')->assertJsonPath('customer.email', null)->assertJsonCount(1, 'customer.addresses');
        $customer = User::findOrFail($response->json('customer.id'));
        $this->assertTrue(Hash::check('InitialPass123', $customer->password));
        $this->assertArrayNotHasKey('password', $response->json('customer'));
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertEquals('Meet at gate', $customer->addresses->first()->notes);
        $this->postJson('/api/login', ['login' => '09123456789', 'password' => 'InitialPass123'])->assertOk()->assertJsonPath('user.id', $customer->id);
    }

    public function test_validation_prevents_duplicate_contact_and_partial_customer_creation(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $count = User::count();
        $bad = $this->intake();
        $bad['address'] = '';
        $this->postJson('/api/staff/customers', $bad)->assertUnprocessable();
        $this->assertDatabaseCount('users', $count);
        $this->assertDatabaseCount('addresses', 0);
        $this->postJson('/api/staff/customers', $this->intake())->assertCreated();
        $this->postJson('/api/staff/customers', $this->intake())->assertUnprocessable()->assertJsonValidationErrors('phone');
        $another = $this->intake();
        $another['phone'] = '09987654321';
        $another['password_confirmation'] = 'Incorrect123';
        $this->postJson('/api/staff/customers', $another)->assertUnprocessable();
        $another['password_confirmation'] = $another['password'];
        $this->postJson('/api/staff/customers', $another)->assertCreated()->assertJsonPath('customer.email', null);
    }

    public function test_staff_orders_use_customer_owned_address_active_service_and_existing_payment_rules(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $data = $this->postJson('/api/staff/customers', $this->intake())->assertCreated()->json('customer');
        $service = Service::create(['name' => 'Fixed laundry', 'pricing_type' => 'fixed', 'rate' => 150, 'is_active' => true]);
        $path = '/api/staff/customers/'.$data['id'].'/orders';
        $payload = ['address_id' => $data['addresses'][0]['id'], 'service_id' => $service->id, 'payment_preference' => 'GCash', 'notes' => 'Wash separately', 'payment_status' => 'Paid', 'status' => 'Delivered'];
        $response = $this->postJson($path, $payload)->assertCreated()->assertJsonPath('order.user_id', $data['id'])->assertJsonPath('order.status', 'Pending')->assertJsonPath('order.payment_status', 'Unpaid')->assertJsonPath('order.notes', 'Wash separately');
        $order = Order::findOrFail($response->json('order.id'));
        $this->assertEquals('Unpaid', $order->payment_status);
        $this->assertEquals('GCash', $order->payment_preference);
        $this->assertEquals(150, $order->total_amount);
        $this->assertNull($order->weight);
        $foreign = Address::create(['user_id' => User::factory()->create()->id, 'address' => 'Other street']);
        $payload['address_id'] = $foreign->id;
        $this->postJson($path, $payload)->assertNotFound();
        $payload['address_id'] = $data['addresses'][0]['id'];
        Address::findOrFail($payload['address_id'])->update(['archived_at' => now()]);
        $this->postJson($path, $payload)->assertNotFound();
        $new = $this->postJson('/api/staff/customers/'.$data['id'].'/addresses', ['address' => 'Another street', 'delivery_zone_id' => 999])->assertCreated()->json('address');
        $this->assertNull($new['delivery_zone_id']);
        $payload['address_id'] = $new['id'];
        $service->update(['is_active' => false]);
        $this->postJson($path, $payload)->assertNotFound();
        $this->assertDatabaseCount('orders', 1);
        $service->update(['is_active' => true, 'pricing_type' => 'per_kg']);
        $this->postJson($path, $payload)->assertCreated()->assertJsonPath('order.total_amount', '0.00');
    }

    public function test_customers_cannot_use_staff_intake_and_staff_cannot_book_for_staff_or_riders(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($customer);
        $this->postJson('/api/staff/customers', $this->intake())->assertForbidden();
        $this->postJson('/api/staff/customers/'.$customer->id.'/addresses', ['address' => 'Street'])->assertForbidden();
        $this->postJson('/api/staff/customers/'.$customer->id.'/orders', [])->assertForbidden();
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $rider = User::factory()->create(['role' => 'rider']);
        $this->postJson('/api/staff/customers/'.$rider->id.'/addresses', ['address' => 'Street'])->assertNotFound();
        $this->postJson('/api/staff/customers/'.$rider->id.'/orders', [])->assertNotFound();
    }

    public function test_phone_only_customer_can_change_password_only_with_correct_current_password(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'email' => null, 'phone' => '09123456789', 'password' => 'InitialPass123']);
        Sanctum::actingAs($customer);
        $payload = ['name' => $customer->name, 'email' => null, 'phone' => $customer->phone, 'password' => 'UpdatedPass123', 'password_confirmation' => 'UpdatedPass123'];
        $this->putJson('/api/customer/profile', $payload)->assertUnprocessable();
        $payload['current_password'] = 'WrongPass123';
        $this->putJson('/api/customer/profile', $payload)->assertUnprocessable();
        $this->assertTrue(Hash::check('InitialPass123', $customer->fresh()->password));
        $payload['current_password'] = 'InitialPass123';
        $this->putJson('/api/customer/profile', $payload)->assertOk();
        $this->assertTrue(Hash::check('UpdatedPass123', $customer->fresh()->password));
        $this->postJson('/api/login', ['login' => $customer->phone, 'password' => 'InitialPass123'])->assertUnprocessable();
        $this->postJson('/api/login', ['login' => $customer->phone, 'password' => 'UpdatedPass123'])->assertOk();
        $this->putJson('/api/customer/profile', ['name' => $customer->name, 'email' => '', 'phone' => ''])->assertUnprocessable();
    }

    public function test_email_login_stays_compatible_and_ambiguous_phone_login_is_rejected(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'phone' => '09123456789', 'password' => 'InitialPass123']);
        $this->postJson('/api/login', ['email' => $customer->email, 'password' => 'InitialPass123'])->assertOk();
        User::factory()->create(['role' => 'customer', 'phone' => $customer->phone]);
        $this->postJson('/api/login', ['login' => $customer->phone, 'password' => 'InitialPass123'])->assertUnprocessable();
    }
}
