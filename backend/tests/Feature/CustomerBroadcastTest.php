<?php

namespace Tests\Feature;

use App\Events\CustomerOrdersChanged;
use App\Models\Address;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerBroadcastTest extends TestCase
{
    use RefreshDatabase;

    public function test_auth_rejects_guests_other_customers_and_staff(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $payload = ['channel_name' => 'private-customers.'.$customer->id, 'socket_id' => '123.456'];
        $this->postJson('/api/customer/broadcasting/auth', $payload)->assertUnauthorized();
        Sanctum::actingAs(User::factory()->create(['role' => 'customer']));
        $this->postJson('/api/customer/broadcasting/auth', $payload)->assertForbidden();
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $this->postJson('/api/customer/broadcasting/auth', $payload)->assertForbidden();
        Sanctum::actingAs($customer);
        $this->postJson('/api/customer/broadcasting/auth', ['channel_name' => 'customers.'.$customer->id, 'socket_id' => '123.456'])->assertForbidden();
        $this->postJson('/api/customer/broadcasting/auth', ['channel_name' => $payload['channel_name'], 'socket_id' => 'invalid'])->assertUnprocessable();
    }

    public function test_own_customer_channel_delegates_signing_to_broadcaster(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($customer);
        Broadcast::shouldReceive('auth')->once()->withArgs(fn ($request) => $request->user()->id === $customer->id)->andReturn(['auth' => 'test-signature']);
        $this->postJson('/api/customer/broadcasting/auth', ['channel_name' => 'private-customers.'.$customer->id, 'socket_id' => '123.456'])->assertOk()->assertJsonPath('auth', 'test-signature');
    }

    public function test_live_event_is_private_and_carries_no_customer_information(): void
    {
        $event = new CustomerOrdersChanged(42);
        $this->assertEquals('private-customers.42', $event->broadcastOn()[0]->name);
        $this->assertSame([], $event->broadcastWith());
        $this->assertEquals('orders.changed', $event->broadcastAs());
        $this->assertEquals('live-updates', $event->broadcastQueue());
    }

    public function test_live_job_rolls_back_with_order_and_notification(): void
    {
        config(['services.order_updates.live_enabled' => true, 'services.order_updates.email_enabled' => false]);
        $customer = User::factory()->create(['role' => 'customer']);
        $address = Address::create(['user_id' => $customer->id, 'address' => 'Test street']);
        DB::beginTransaction();
        try {
            Order::create(['user_id' => $customer->id, 'address_id' => $address->id, 'order_number' => 'WS-LIVE', 'status' => 'Pending']);
            $this->assertDatabaseHas('jobs', ['queue' => 'live-updates']);
        } finally {
            DB::rollBack();
        }
        $this->assertDatabaseCount('jobs', 0);
        $this->assertDatabaseCount('notifications', 0);
        $this->assertDatabaseCount('orders', 0);
    }
}
