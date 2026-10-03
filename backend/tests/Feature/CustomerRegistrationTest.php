<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerRegistrationTest extends TestCase
{
    use RefreshDatabase;

    private function details(): array
    {
        return ['name' => 'New Customer', 'email' => 'new@example.test', 'phone' => null, 'password' => 'test-password', 'password_confirmation' => 'test-password'];
    }

    public function test_public_signup_creates_customer_and_token_without_accepting_role_escalation(): void
    {
        $response = $this->postJson('/api/register', [...$this->details(), 'role' => 'admin'])->assertCreated()->assertJsonPath('user.role', 'customer');
        $this->assertNotEmpty($response->json('token'));
        $this->assertArrayNotHasKey('password', $response->json('user'));
        $this->withToken($response->json('token'))->getJson('/api/user')->assertOk()->assertJsonPath('role', 'customer');
    }

    public function test_duplicate_email_and_mismatched_password_do_not_create_accounts(): void
    {
        User::factory()->create(['email' => 'new@example.test']);
        $this->postJson('/api/register', $this->details())->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->postJson('/api/register', [...$this->details(), 'email' => 'other@example.test', 'password_confirmation' => 'different'])->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
