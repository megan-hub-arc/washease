<?php

namespace App\Providers;

use App\Models\DeliveryRun;
use App\Models\Order;
use App\Observers\DeliveryRunObserver;
use App\Observers\OrderObserver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
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
        RateLimiter::for('auth-login', function (Request $request): array {
            $identifier = $request->input('login', $request->input('email', ''));
            $identifier = is_string($identifier) ? strtolower(trim($identifier)) : '';
            $response = static fn (Request $request, array $headers): JsonResponse => response()->json([
                'message' => 'Too many sign-in attempts. Wait one minute and try again.',
            ], 429, $headers);

            return [
                Limit::perMinute(60)->by('login-ip:'.$request->ip())->response($response),
                Limit::perMinute(5)->by('login-account:'.hash('sha256', $identifier.'|'.$request->ip()))->response($response),
            ];
        });

        RateLimiter::for('auth-register', fn (Request $request): Limit => Limit::perMinute(5)
            ->by('register-ip:'.$request->ip())
            ->response(static fn (Request $request, array $headers): JsonResponse => response()->json([
                'message' => 'Too many registration attempts. Wait one minute and try again.',
            ], 429, $headers)));

        require base_path('routes/channels.php');
        Order::observe(OrderObserver::class);
        DeliveryRun::observe(DeliveryRunObserver::class);
    }
}
