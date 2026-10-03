<?php

namespace App\Providers;

use App\Models\DeliveryRun;
use App\Models\Order;
use App\Observers\DeliveryRunObserver;
use App\Observers\OrderObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Order::observe(OrderObserver::class);
        DeliveryRun::observe(DeliveryRunObserver::class);
    }
}
