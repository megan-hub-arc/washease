<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function profile(Request $request)
    {
        return response()->json([
            'user' => $request->user(),
        ]);
    }

    public function staffIndex(Request $request)
    {
        $this->ensureStaffOrAdmin($request);

        return response()->json(
            User::where('role', 'customer')
                ->with([
                    'addresses.deliveryZone',
                    'orders',
                ])
                ->orderBy('name')
                ->get()
        );
    }

    private function ensureStaffOrAdmin(Request $request): void
    {
        abort_unless(
            in_array($request->user()->role, ['staff', 'admin']),
            403
        );
    }
}
