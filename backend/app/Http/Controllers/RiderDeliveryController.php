<?php

namespace App\Http\Controllers;

use App\Models\DeliveryRun;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class RiderDeliveryController extends Controller
{
    public function issue(Request $request, DeliveryRun $deliveryRun): JsonResponse
    {
        $this->ensureStaff($request);
        $data = $request->validate(['expires_in_minutes' => ['required', 'integer', 'min:15', 'max:720']]);

        return DB::transaction(function () use ($deliveryRun, $data): JsonResponse {
            $run = DeliveryRun::whereKey($deliveryRun->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($run->status, ['Planned', 'Started']) && $run->returned_at === null, 422, 'Only active delivery runs can receive a rider link.');
            abort_if(! $run->orders()->exists(), 422, 'Assign orders before creating a rider link.');
            $token = Str::random(64);
            $run->forceFill([
                'rider_link_token_hash' => hash('sha256', $token),
                'rider_link_session_hash' => null,
                'rider_link_expires_at' => now()->addMinutes($data['expires_in_minutes']),
                'rider_link_claimed_at' => null,
            ])->save();

            return response()->json([
                'url' => URL::temporarySignedRoute('rider.access', $run->rider_link_expires_at, ['deliveryRun' => $run->id, 'token' => $token]),
                'expires_at' => $run->rider_link_expires_at->toIso8601String(),
                'message' => 'New rider link created. Previous links and rider sessions for this run are revoked.',
            ])->header('Cache-Control', 'no-store');
        });
    }

    public function revoke(Request $request, DeliveryRun $deliveryRun): JsonResponse
    {
        $this->ensureStaff($request);
        DB::transaction(function () use ($deliveryRun): void {
            $run = DeliveryRun::whereKey($deliveryRun->id)->lockForUpdate()->firstOrFail();
            $run->forceFill(['rider_link_token_hash' => null, 'rider_link_session_hash' => null, 'rider_link_expires_at' => null, 'rider_link_claimed_at' => null])->save();
        });

        return response()->json(['message' => 'Rider access revoked.']);
    }

    public function access(Request $request, DeliveryRun $deliveryRun): Response
    {
        $this->ensureClaimable($request, $deliveryRun);

        return $this->page(['mode' => 'access', 'claimUrl' => $request->fullUrl()]);
    }

    public function claim(Request $request, DeliveryRun $deliveryRun): RedirectResponse
    {
        return DB::transaction(function () use ($request, $deliveryRun): RedirectResponse {
            $run = DeliveryRun::whereKey($deliveryRun->id)->lockForUpdate()->firstOrFail();
            $this->ensureClaimable($request, $run);
            $request->session()->regenerate(true);
            $sessionToken = Str::random(64);
            $run->forceFill([
                'rider_link_token_hash' => null,
                'rider_link_session_hash' => hash('sha256', $sessionToken),
                'rider_link_claimed_at' => now(),
            ])->save();
            $request->session()->put('rider_run_access.'.$run->id, $sessionToken);

            return redirect()->route('rider.run', ['deliveryRun' => $run->id])->header('Cache-Control', 'no-store')->header('Referrer-Policy', 'no-referrer');
        });
    }

    public function show(Request $request, DeliveryRun $deliveryRun): Response
    {
        $this->ensureSession($request, $deliveryRun);
        if ($deliveryRun->status === 'Completed') {
            return $this->page(['mode' => 'completed']);
        }
        $orders = $deliveryRun->orders()->with(['user:id,name,phone', 'address:id,address'])->orderBy('delivery_sequence')->orderBy('id')->get();

        return $this->page(['mode' => 'run', 'run' => $deliveryRun, 'orders' => $orders]);
    }

    public function confirm(Request $request, DeliveryRun $deliveryRun, Order $order): RedirectResponse
    {
        return DB::transaction(function () use ($request, $deliveryRun, $order): RedirectResponse {
            $run = DeliveryRun::whereKey($deliveryRun->id)->lockForUpdate()->firstOrFail();
            $this->ensureSession($request, $run);
            abort_unless($run->status === 'Started' && $run->started_at !== null, 422, 'Wait for staff to depart this run.');
            $current = $run->orders()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            abort_unless($current->status === 'Ready for Delivery', 422, 'This order cannot be confirmed again or is not ready for delivery.');
            $current->update(['status' => 'Delivered', 'delivered_at' => now()]);
            if (! $run->orders()->where('status', '!=', 'Delivered')->exists()) {
                $run->update(['status' => 'Completed', 'completed_at' => now()]);
            }

            return redirect()->route('rider.run', ['deliveryRun' => $run->id])->with('rider_message', 'Delivery confirmed. Payment collection and return remain with staff.')->header('Cache-Control', 'no-store');
        });
    }

    private function ensureStaff(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['staff', 'admin']), 403);
    }

    private function ensureClaimable(Request $request, DeliveryRun $run): void
    {
        $token = $request->query('token');
        abort_unless(is_string($token) && $run->rider_link_token_hash !== null && hash_equals($run->rider_link_token_hash, hash('sha256', $token)) && $run->rider_link_claimed_at === null && $run->rider_link_expires_at?->isFuture() && in_array($run->status, ['Planned', 'Started']) && $run->returned_at === null, 403, 'This rider link is unavailable. Ask staff for a new link.');
    }

    private function ensureSession(Request $request, DeliveryRun $run): void
    {
        $token = $request->session()->get('rider_run_access.'.$run->id);
        abort_unless(is_string($token) && $run->rider_link_session_hash !== null && hash_equals($run->rider_link_session_hash, hash('sha256', $token)) && $run->rider_link_expires_at?->isFuture() && $run->returned_at === null && in_array($run->status, ['Planned', 'Started', 'Completed']), 403, 'Rider access has expired or was revoked. Ask staff for a new link.');
    }

    /** @param array<string, mixed> $data */
    private function page(array $data): Response
    {
        return response()->view('rider-delivery', $data)->withHeaders([
            'Cache-Control' => 'no-store, private',
            'Referrer-Policy' => 'no-referrer',
            'X-Robots-Tag' => 'noindex, nofollow, noarchive',
            'X-Frame-Options' => 'DENY',
            'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
        ]);
    }
}
