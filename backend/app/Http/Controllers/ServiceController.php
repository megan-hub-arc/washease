<?php

namespace App\Http\Controllers;

use App\Models\Service;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function index()
    {
        return response()->json(
            Service::where('is_active', true)
                ->orderBy('name')
                ->get()
        );
    }

    public function staffIndex(Request $request)
    {
        $this->ensureStaffOrAdmin($request);

        return response()->json(
            Service::orderBy('name')->get()
        );
    }

    public function store(Request $request)
    {
        $this->ensureStaffOrAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'pricing_type' => ['required', 'string', 'in:per_kg,fixed'],
            'rate' => ['required', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $service = Service::create([
            'name' => $validated['name'],
            'pricing_type' => $validated['pricing_type'],
            'rate' => $validated['rate'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'message' => 'Service created successfully.',
            'service' => $service,
        ], 201);
    }

    public function update(Request $request, Service $service)
    {
        $this->ensureStaffOrAdmin($request);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'pricing_type' => ['sometimes', 'required', 'string', 'in:per_kg,fixed'],
            'rate' => ['sometimes', 'required', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $service->update($validated);

        return response()->json([
            'message' => 'Service updated successfully.',
            'service' => $service->fresh(),
        ]);
    }

    private function ensureStaffOrAdmin(Request $request): void
    {
        abort_unless(
            in_array($request->user()->role, ['staff', 'admin']),
            403
        );
    }
}