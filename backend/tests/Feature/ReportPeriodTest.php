<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReportPeriodTest extends TestCase
{
    use RefreshDatabase;

    public function test_reports_separate_booking_and_collection_dates_using_philippine_boundaries(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $customer = User::factory()->create(['role' => 'customer']);
        $address = Address::create(['user_id' => $customer->id, 'address' => 'Test street']);
        foreach ([['2026-10-01 10:00:00', '2026-10-02 16:00:00', 120], ['2026-10-03 15:59:59', '2026-10-03 16:00:00', 80]] as $index => [$created, $paid, $amount]) {
            $order = Order::create(['user_id' => $customer->id, 'address_id' => $address->id, 'order_number' => 'REPORT-'.$index, 'status' => 'Delivered', 'payment_status' => 'Paid', 'payment_method' => 'Cash', 'total_amount' => $amount, 'paid_at' => $paid]);
            $order->forceFill(['created_at' => $created])->save();
        }
        $result = $this->getJson('/api/staff/reports?from=2026-10-03&to=2026-10-03')->assertOk()->assertJsonPath('total_orders', 1)->assertJsonPath('payments.paid', 1)->assertJsonPath('period.timezone', 'Asia/Manila');
        $this->assertEquals(120, $result->json('total_revenue'));
        $all = $this->getJson('/api/staff/reports')->assertOk()->assertJsonPath('total_orders', 2);
        $this->assertEquals(200, $all->json('total_revenue'));
    }

    public function test_reports_reject_invalid_ranges_and_customers(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $this->getJson('/api/staff/reports?from=2026-10-04&to=2026-10-03')->assertUnprocessable();
        $this->getJson('/api/staff/reports?from=2026-10-03')->assertUnprocessable();
        Sanctum::actingAs(User::factory()->create(['role' => 'customer']));
        $this->getJson('/api/staff/reports')->assertForbidden();
    }
}
