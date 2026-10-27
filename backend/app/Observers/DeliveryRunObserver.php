<?php

namespace App\Observers;

use App\Models\AuditLog;
use App\Models\DeliveryRun;
use App\Services\CustomerOrderUpdates;

class DeliveryRunObserver
{
    public function updated(DeliveryRun $run): void
    {
        AuditLog::recordChanges($run, 'run_status');
        AuditLog::recordChanges($run, 'run_return');
        if ($run->wasChanged('status') && $run->status === 'Started') {
            foreach ($run->orders()->with('user')->get() as $order) {
                CustomerOrderUpdates::send($order, 'departed');
            }
        }
    }
}
