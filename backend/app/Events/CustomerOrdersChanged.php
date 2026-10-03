<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

class CustomerOrdersChanged implements ShouldBroadcast
{
    public string $connection = 'order-mail';

    public bool $afterCommit = false;

    public function __construct(public int $customerId) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('customers.'.$this->customerId)];
    }

    public function broadcastAs(): string
    {
        return 'orders.changed';
    }

    public function broadcastQueue(): string
    {
        return 'live-updates';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
