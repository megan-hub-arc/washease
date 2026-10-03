<?php

namespace Tests\Feature;

use App\Models\DeliveryRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RiderManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_add_rider_without_credentials_and_edit_contact_without_changing_assignments(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $response = $this->postJson('/api/staff/riders', ['name' => 'New Rider', 'phone' => '09123456789', 'role' => 'admin'])->assertCreated();
        $rider = User::findOrFail($response->json('id'));
        $this->assertEquals('rider', $rider->role);
        $run = DeliveryRun::create(['rider_id' => $rider->id, 'status' => 'Started', 'capacity_kg' => 10, 'max_orders' => 20, 'total_load_kg' => 0]);
        $this->putJson('/api/staff/riders/'.$rider->id, ['name' => 'Updated Rider', 'phone' => '09987654321', 'rider_on_duty' => false])->assertOk();
        $this->assertEquals('Updated Rider', $rider->fresh()->name);
        $this->assertTrue($rider->fresh()->rider_on_duty);
        $this->assertEquals($rider->id, $run->fresh()->rider_id);
        $this->assertEquals('Started', $run->fresh()->status);
        $entry = collect($this->getJson('/api/staff/riders')->assertOk()->json())->firstWhere('id', $rider->id);
        $this->assertNull($entry['email']);
        $this->assertArrayNotHasKey('password', $entry);
    }

    public function test_rider_contact_requires_phone_and_cannot_edit_customers_or_be_managed_by_customers(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $this->postJson('/api/staff/riders', ['name' => 'Missing phone'])->assertUnprocessable();
        $this->putJson('/api/staff/riders/'.$customer->id, ['name' => 'Invalid', 'phone' => '09123456789'])->assertNotFound();
        Sanctum::actingAs($customer);
        $this->postJson('/api/staff/riders', ['name' => 'Unauthorized', 'phone' => '09123456789'])->assertForbidden();
        $this->putJson('/api/staff/riders/'.$customer->id, ['name' => 'Unauthorized', 'phone' => '09123456789'])->assertForbidden();
    }
}
