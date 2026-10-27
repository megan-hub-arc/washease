<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role, ['staff', 'admin'], true), 403);
        $validated = $request->validate([
            'action' => ['sometimes', Rule::in(array_keys(AuditLog::ACTION_FIELDS))],
            'subject_type' => ['sometimes', Rule::in(['order', 'delivery_run'])],
            'subject_id' => ['sometimes', 'integer', 'min:1'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $query = AuditLog::query();
        foreach (['action', 'subject_type', 'subject_id'] as $field) {
            if (isset($validated[$field])) {
                $query->where($field, $validated[$field]);
            }
        }

        return response()->json($query->orderByDesc('id')->paginate((int) ($validated['per_page'] ?? 20)))
            ->header('Cache-Control', 'no-store, private');
    }
}
