<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use LogicException;

#[Fillable(['actor_user_id', 'actor_name', 'actor_role', 'action', 'subject_type', 'subject_id', 'subject_label', 'before_values', 'after_values'])]
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    public const ACTION_FIELDS = [
        'order_status' => ['status', 'delivered_at'],
        'order_payment' => ['payment_status', 'payment_method', 'paid_at'],
        'order_assignment' => ['delivery_run_id'],
        'order_weight' => ['weight', 'total_amount'],
        'order_requested_times' => ['pickup_requested_at', 'delivery_requested_at'],
        'run_status' => ['status', 'started_at', 'completed_at'],
        'run_return' => ['returned_at', 'return_confirmed_by'],
    ];

    protected static function booted(): void
    {
        static::updating(function (): void {
            throw new LogicException('Audit records cannot be edited.');
        });
        static::deleting(function (): void {
            throw new LogicException('Audit records cannot be deleted.');
        });
    }

    public static function recordChanges(Order|DeliveryRun $subject, string $action): void
    {
        $actor = auth()->user();
        if ($actor === null || ! in_array($actor->role, ['staff', 'admin'], true)) {
            return;
        }
        $fields = array_intersect(self::ACTION_FIELDS[$action] ?? [], array_keys($subject->getChanges()));
        if ($fields === []) {
            return;
        }
        $before = [];
        $after = [];
        foreach ($fields as $field) {
            $before[$field] = $subject->getRawOriginal($field);
            $after[$field] = $subject->getAttributes()[$field] ?? null;
        }
        self::create([
            'actor_user_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role,
            'action' => $action,
            'subject_type' => $subject instanceof Order ? 'order' : 'delivery_run',
            'subject_id' => $subject->id,
            'subject_label' => $subject instanceof Order ? $subject->order_number : 'Run #'.$subject->id,
            'before_values' => $before,
            'after_values' => $after,
        ]);
    }

    protected function casts(): array
    {
        return [
            'before_values' => 'array',
            'after_values' => 'array',
            'created_at' => 'datetime',
        ];
    }
}
