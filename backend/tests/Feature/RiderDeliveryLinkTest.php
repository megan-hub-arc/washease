<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\DeliveryRun;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RiderDeliveryLinkTest extends TestCase
{
    use RefreshDatabase;

    private function runWithOrder(string $status = 'Started'): DeliveryRun
    {
        $run = DeliveryRun::create([
            'rider_id' => User::factory()->create(['role' => 'rider'])->id,
            'status' => $status, 'capacity_kg' => 20, 'total_load_kg' => 3, 'max_orders' => 20,
            'started_at' => $status === 'Started' ? now() : null,
        ]);
        $customer = User::factory()->create(['role' => 'customer', 'name' => 'Rider Test Customer', 'phone' => '09123456789']);
        $address = Address::create(['user_id' => $customer->id, 'address' => 'Private delivery street']);
        Order::create([
            'user_id' => $customer->id, 'address_id' => $address->id,
            'order_number' => fake()->unique()->bothify('WS-########'),
            'weight' => 3, 'status' => 'Ready for Delivery', 'delivery_run_id' => $run->id,
            'delivery_sequence' => 1, 'payment_status' => 'Unpaid',
        ]);

        return $run;
    }

    private function issueLink(DeliveryRun $run): string
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));

        return $this->postJson("/api/staff/delivery-runs/{$run->id}/rider-link", ['expires_in_minutes' => 60])->assertOk()->json('url');
    }

    private function grantSession(DeliveryRun $run): void
    {
        $run->forceFill(['rider_link_session_hash' => hash('sha256', 'test-session-secret'), 'rider_link_expires_at' => now()->addHour(), 'rider_link_claimed_at' => now()])->save();
        $this->withSession(['rider_run_access' => [$run->id => 'test-session-secret']]);
    }

    public function test_staff_issues_private_link_and_customer_cannot_issue_or_revoke(): void
    {
        $run = $this->runWithOrder();
        $url = $this->issueLink($run);
        $this->assertStringContainsString('signature=', $url);
        $this->assertStringNotContainsString($run->fresh()->rider_link_token_hash, $run->fresh()->toJson());
        Sanctum::actingAs(User::factory()->create(['role' => 'customer']));
        $this->postJson("/api/staff/delivery-runs/{$run->id}/rider-link", ['expires_in_minutes' => 60])->assertForbidden();
        $this->deleteJson("/api/staff/delivery-runs/{$run->id}/rider-link")->assertForbidden();
    }

    public function test_unauthenticated_staff_actions_and_rider_accounts_are_rejected(): void
    {
        $run = $this->runWithOrder();
        $this->postJson("/api/staff/delivery-runs/{$run->id}/rider-link", ['expires_in_minutes' => 60])->assertUnauthorized();
        $this->deleteJson("/api/staff/delivery-runs/{$run->id}/rider-link")->assertUnauthorized();
        Sanctum::actingAs(User::factory()->create(['role' => 'rider']));
        $this->postJson("/api/staff/delivery-runs/{$run->id}/rider-link", ['expires_in_minutes' => 60])->assertForbidden();
        $this->deleteJson("/api/staff/delivery-runs/{$run->id}/rider-link")->assertForbidden();
    }

    public function test_duration_limits_and_empty_runs_are_rejected(): void
    {
        $run = $this->runWithOrder();
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        foreach ([0, 14, 721] as $minutes) {
            $this->postJson("/api/staff/delivery-runs/{$run->id}/rider-link", ['expires_in_minutes' => $minutes])->assertUnprocessable();
        }
        $run->orders()->update(['delivery_run_id' => null]);
        $this->postJson("/api/staff/delivery-runs/{$run->id}/rider-link", ['expires_in_minutes' => 60])->assertUnprocessable();
    }

    public function test_preview_does_not_consume_link_or_disclose_customer_and_claim_is_once(): void
    {
        $run = $this->runWithOrder();
        $url = $this->issueLink($run);
        $this->get($url)->assertOk()->assertDontSee('Private delivery street')->assertDontSee('09123456789')->assertHeader('Referrer-Policy', 'no-referrer');
        $this->assertNull($run->fresh()->rider_link_claimed_at);
        $this->get($url)->assertOk();
        $this->post($url)->assertRedirect(route('rider.run', ['deliveryRun' => $run->id]))->assertSessionHas('rider_run_access.'.$run->id);
        $this->assertNull($run->fresh()->rider_link_token_hash);
        $this->post($url)->assertForbidden();
        $this->get(route('rider.run', ['deliveryRun' => $run->id]))->assertOk()->assertSee('Private delivery street');
    }

    public function test_tampered_and_expired_signed_links_are_rejected(): void
    {
        $run = $this->runWithOrder();
        $url = $this->issueLink($run);
        $this->get($url.'&unexpected=1')->assertForbidden();
        $this->travel(61)->minutes();
        $this->get($url)->assertForbidden();
        $this->post($url)->assertForbidden();
    }

    public function test_replacing_or_revoking_link_invalidates_old_link_and_session(): void
    {
        $run = $this->runWithOrder();
        $old = $this->issueLink($run);
        $this->grantSession($run);
        $this->get(route('rider.run', ['deliveryRun' => $run->id]))->assertOk();
        $new = $this->issueLink($run);
        $this->get($old)->assertForbidden();
        $this->get(route('rider.run', ['deliveryRun' => $run->id]))->assertForbidden();
        $this->get($new)->assertOk();
        $this->grantSession($run);
        $this->deleteJson("/api/staff/delivery-runs/{$run->id}/rider-link")->assertOk();
        $this->get($new)->assertForbidden();
        $this->get(route('rider.run', ['deliveryRun' => $run->id]))->assertForbidden();
    }

    public function test_session_is_run_scoped_and_expires(): void
    {
        $run = $this->runWithOrder();
        $other = $this->runWithOrder();
        $this->get(route('rider.run', ['deliveryRun' => $run->id]))->assertForbidden();
        $this->grantSession($run);
        $this->get(route('rider.run', ['deliveryRun' => $other->id]))->assertForbidden();
        $this->travel(61)->minutes();
        $this->get(route('rider.run', ['deliveryRun' => $run->id]))->assertForbidden();
    }

    public function test_delivery_requires_departure_and_order_must_belong_to_run(): void
    {
        $run = $this->runWithOrder('Planned');
        $other = $this->runWithOrder();
        $this->grantSession($run);
        $url = route('rider.confirm', ['deliveryRun' => $run->id, 'order' => $run->orders()->first()->id]);
        $this->post($url)->assertUnprocessable();
        $run->update(['status' => 'Started', 'started_at' => now()]);
        $this->post(route('rider.confirm', ['deliveryRun' => $run->id, 'order' => $other->orders()->first()->id]))->assertNotFound();
    }

    public function test_delivery_timestamps_notifies_once_and_keeps_payment_and_return_separate(): void
    {
        $run = $this->runWithOrder();
        $order = $run->orders()->first();
        $this->grantSession($run);
        $before = $order->user->notifications()->count();
        $url = route('rider.confirm', ['deliveryRun' => $run->id, 'order' => $order->id]);
        $this->post($url)->assertRedirect(route('rider.run', ['deliveryRun' => $run->id]));
        $this->assertEquals('Delivered', $order->fresh()->status);
        $this->assertNotNull($order->fresh()->delivered_at);
        $this->assertEquals('Unpaid', $order->fresh()->payment_status);
        $this->assertEquals('Completed', $run->fresh()->status);
        $this->assertNull($run->fresh()->returned_at);
        $this->assertEquals($before + 1, $order->user->notifications()->count());
        $confirmedAt = $order->fresh()->delivered_at;
        $this->post($url)->assertUnprocessable();
        $this->assertTrue($confirmedAt->equalTo($order->fresh()->delivered_at));
        $this->assertEquals($before + 1, $order->user->notifications()->count());
        $this->get(route('rider.run', ['deliveryRun' => $run->id]))->assertOk()->assertDontSee('Private delivery street')->assertDontSee('09123456789');
    }

    public function test_run_stays_started_until_last_delivery_and_duplicate_does_not_notify(): void
    {
        $run = $this->runWithOrder();
        $other = $this->runWithOrder();
        $second = $other->orders()->first();
        $second->update(['delivery_run_id' => $run->id]);
        $first = $run->orders()->orderBy('id')->first();
        $this->grantSession($run);
        $url = route('rider.confirm', ['deliveryRun' => $run->id, 'order' => $first->id]);
        $this->post($url)->assertRedirect();
        $this->assertEquals('Started', $run->fresh()->status);
        $count = $first->user->notifications()->count();
        $this->post($url)->assertUnprocessable();
        $this->assertEquals($count, $first->user->notifications()->count());
        $this->post(route('rider.confirm', ['deliveryRun' => $run->id, 'order' => $second->id]))->assertRedirect();
        $this->assertEquals('Completed', $run->fresh()->status);
    }

    public function test_returned_and_completed_runs_cannot_receive_new_links(): void
    {
        $run = $this->runWithOrder();
        $this->issueLink($run);
        $run->update(['status' => 'Completed', 'returned_at' => now()]);
        $this->postJson("/api/staff/delivery-runs/{$run->id}/rider-link", ['expires_in_minutes' => 60])->assertUnprocessable();
        $run->update(['status' => 'Started']);
        $this->grantSession($run);
        $this->get(route('rider.run', ['deliveryRun' => $run->id]))->assertForbidden();
    }
}
