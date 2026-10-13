<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Laravel\Reverb\Application;
use Laravel\Reverb\Contracts\Connection;
use Laravel\Reverb\Protocols\Pusher\Contracts\ChannelManager;
use Laravel\Reverb\Protocols\Pusher\EventHandler;
use Laravel\Reverb\Protocols\Pusher\Server;
use Mockery;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class ProductionSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_bearer_token_is_accepted_before_expiry_and_returns_401_after_eight_hours(): void
    {
        $this->freezeTime();
        $user = User::factory()->create(['role' => 'customer']);
        $token = $user->createToken('expiry-check')->plainTextToken;

        $this->travel(479)->minutes();
        $this->withToken($token)->getJson('/api/user')->assertOk();
        app('auth')->forgetGuards();
        $this->travel(2)->minutes();
        $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
    }

    public function test_cors_preflight_allows_configured_frontend_without_cookies(): void
    {
        $this->withHeaders([
            'Origin' => 'http://localhost:3000',
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'authorization,content-type',
        ])->options('/api/login')->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:3000')
            ->assertHeaderMissing('Access-Control-Allow-Credentials');
    }

    public function test_cors_preflight_does_not_allow_an_unknown_frontend(): void
    {
        $this->withHeaders([
            'Origin' => 'https://untrusted.example.test',
            'Access-Control-Request-Method' => 'POST',
        ])->options('/api/login')->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    #[TestWith(['http://localhost:3000', true])]
    #[TestWith(['https://untrusted.example.test', false])]
    public function test_reverb_origin_settings_control_connection_acceptance(string $origin, bool $allowed): void
    {
        $application = new Application('test', 'test-key', 'test-secret', 60, 30, config('reverb.apps.apps.0.allowed_origins'), 10000);
        $connection = new class($application, $origin) extends Connection
        {
            /** @var array<int, string> */
            public array $messages = [];

            public function __construct(Application $application, string $origin)
            {
                $this->application = $application;
                $this->origin = $origin;
            }

            public function identifier(): string
            {
                return 'test-connection';
            }

            public function id(): string
            {
                return 'test-connection';
            }

            public function send(string $message): void
            {
                $this->messages[] = $message;
            }

            public function control(string $type = '9'): void {}

            public function terminate(): void {}
        };
        $channels = Mockery::mock(ChannelManager::class);
        $handler = Mockery::mock(EventHandler::class);
        if ($allowed) {
            $handler->shouldReceive('handle')->once()->with($connection, 'pusher:connection_established');
        } else {
            $handler->shouldNotReceive('handle');
        }

        (new Server($channels, $handler))->open($connection);

        if ($allowed) {
            $this->assertSame([], $connection->messages);
        } else {
            $this->assertCount(1, $connection->messages);
            $payload = json_decode($connection->messages[0], true);
            $data = is_string($payload['data']) ? json_decode($payload['data'], true) : $payload['data'];
            $this->assertSame('pusher:error', $payload['event']);
            $this->assertSame(4009, $data['code']);
        }
    }

    public function test_untrusted_proxy_cannot_change_client_ip_scheme_or_host(): void
    {
        config(['trustedproxy.proxies' => []]);
        Route::get('/api/security-proxy-probe', fn (Request $request): array => [
            'ip' => $request->ip(), 'secure' => $request->isSecure(), 'host' => $request->host(),
        ]);

        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.10'])
            ->withHeaders(['X-Forwarded-For' => '198.51.100.20', 'X-Forwarded-Proto' => 'https', 'X-Forwarded-Host' => 'untrusted.example.test'])
            ->getJson('/api/security-proxy-probe')->assertOk()
            ->assertJsonPath('ip', '192.0.2.10')->assertJsonPath('secure', false)->assertJsonPath('host', 'localhost');
    }

    public function test_verified_proxy_can_forward_ip_and_https_but_not_host(): void
    {
        config(['trustedproxy.proxies' => ['192.0.2.10']]);
        Route::get('/api/security-proxy-probe', fn (Request $request): array => [
            'ip' => $request->ip(), 'secure' => $request->isSecure(), 'host' => $request->host(),
        ]);

        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.10'])
            ->withHeaders(['X-Forwarded-For' => '198.51.100.20', 'X-Forwarded-Proto' => 'https', 'X-Forwarded-Host' => 'untrusted.example.test'])
            ->getJson('/api/security-proxy-probe')->assertOk()
            ->assertJsonPath('ip', '198.51.100.20')->assertJsonPath('secure', true)->assertJsonPath('host', 'localhost');
    }
}
