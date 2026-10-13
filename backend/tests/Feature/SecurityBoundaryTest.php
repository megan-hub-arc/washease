<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SecurityBoundaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_protected_lists_return_401_for_missing_and_invalid_tokens(): void
    {
        foreach (['/user', '/orders', '/addresses', '/staff/orders', '/staff/customers', '/staff/riders', '/staff/reports'] as $path) {
            $this->getJson('/api'.$path)->assertUnauthorized();
            $this->withToken('invalid-token')->getJson('/api'.$path)->assertUnauthorized();
        }
    }

    public static function unprivilegedRoles(): array
    {
        return ['customer' => ['customer'], 'rider' => ['rider']];
    }

    #[DataProvider('unprivilegedRoles')]
    public function test_staff_lists_and_creates_return_403_for_unprivileged_roles(string $role): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => $role]));

        foreach (['orders', 'customers', 'riders', 'reports', 'addresses', 'services', 'delivery-zones', 'delivery-runs'] as $resource) {
            $this->getJson('/api/staff/'.$resource)->assertForbidden();
        }
        foreach (['customers', 'riders', 'services', 'delivery-zones', 'delivery-runs', 'orders/schedule'] as $resource) {
            $this->postJson('/api/staff/'.$resource, [])->assertForbidden();
        }

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('delivery_runs', 0);
        $this->assertDatabaseCount('services', 0);
        $this->assertDatabaseCount('delivery_zones', 0);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_customer_lists_exclude_other_records_and_foreign_details_return_404(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $other = User::factory()->create(['role' => 'customer']);
        $ownAddress = Address::create(['user_id' => $customer->id, 'address' => 'Own street']);
        $otherAddress = Address::create(['user_id' => $other->id, 'address' => 'Private street']);
        $ownOrder = Order::create(['user_id' => $customer->id, 'address_id' => $ownAddress->id, 'order_number' => 'WS-OWN']);
        $otherOrder = Order::create(['user_id' => $other->id, 'address_id' => $otherAddress->id, 'order_number' => 'WS-PRIVATE']);
        Sanctum::actingAs($customer);

        $this->getJson('/api/orders')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $ownOrder->id);
        $this->getJson('/api/addresses')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $ownAddress->id);
        $this->getJson('/api/orders/'.$otherOrder->id)->assertNotFound();
        $this->getJson('/api/addresses/'.$otherAddress->id)->assertNotFound();
        $this->putJson('/api/orders/'.$otherOrder->id.'/status', ['status' => 'Confirmed'])->assertForbidden();

        $this->assertDatabaseHas('orders', ['id' => $otherOrder->id, 'status' => 'Pending']);
    }

    public function test_logout_revokes_only_the_current_token_and_rejects_its_reuse_with_401(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $token = $customer->createToken('current');
        $otherToken = $customer->createToken('other-device');
        $this->withToken($token->plainTextToken)->getJson('/api/user')->assertOk();
        app('auth')->forgetGuards();

        $this->withToken($token->plainTextToken)->postJson('/api/logout')->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $token->accessToken->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $otherToken->accessToken->id]);
        app('auth')->forgetGuards();
        $this->withToken($token->plainTextToken)->getJson('/api/user')->assertUnauthorized();
        app('auth')->forgetGuards();
        $this->withToken($otherToken->plainTextToken)->getJson('/api/user')->assertOk();
    }

    public function test_login_returns_429_after_five_attempts_and_allows_retry_after_expiry(): void
    {
        $this->freezeTime();
        $customer = User::factory()->create(['role' => 'customer', 'email' => 'limit@example.test', 'password' => 'correct-password']);
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/login', ['login' => $customer->email, 'password' => 'wrong-password'])->assertUnprocessable();
        }

        $this->postJson('/api/login', ['login' => strtoupper($customer->email), 'password' => 'correct-password'])
            ->assertTooManyRequests()->assertHeader('Retry-After')
            ->assertJsonPath('message', 'Too many sign-in attempts. Wait one minute and try again.');
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->travel(61)->seconds();
        $response = $this->postJson('/api/login', ['login' => $customer->email, 'password' => 'correct-password'])->assertOk();
        $this->assertNotEmpty($response->json('token'));
        $this->assertArrayNotHasKey('password', $response->json('user'));
        $this->assertDatabaseCount('personal_access_tokens', 1);
    }

    public function test_login_ip_limit_blocks_rotating_identifiers_with_429(): void
    {
        $this->freezeTime();
        for ($attempt = 0; $attempt < 60; $attempt++) {
            $this->postJson('/api/login', ['login' => 'missing-'.$attempt.'@example.test', 'password' => 'wrong'])->assertUnprocessable();
        }

        $this->postJson('/api/login', ['login' => 'next@example.test', 'password' => 'wrong'])->assertTooManyRequests();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_registration_returns_429_after_five_attempts_without_creating_extra_accounts(): void
    {
        $this->freezeTime();
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/register', [])->assertUnprocessable();
        }
        $details = ['name' => 'Blocked', 'email' => 'blocked@example.test', 'password' => 'test-password', 'password_confirmation' => 'test-password'];

        $this->postJson('/api/register', $details)->assertTooManyRequests()->assertHeader('Retry-After')
            ->assertJsonPath('message', 'Too many registration attempts. Wait one minute and try again.');

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->travel(61)->seconds();
        $this->postJson('/api/register', $details)->assertCreated()->assertJsonPath('user.role', 'customer');
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('personal_access_tokens', 1);
    }
}
