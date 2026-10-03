# Live updates setup

Reverb sends an empty refresh signal on a private customer channel. The frontend then fetches its orders and notifications using its bearer token. The page still checks every 15 seconds while visible and resyncs on reconnect or returning to the tab. No GPS or rider portal is added.

## Install locally

Composer could not reach Packagist in the development workspace. Reverb installation and real WebSocket delivery require local verification. From backend:

```powershell
composer require laravel/reverb
php artisan reverb:install --no-interaction
```

Keep our config/broadcasting.php and routes/channels.php if prompted to overwrite them. The installer publishes config/reverb.php and generates credentials in .env. Do not run install:broadcasting; our bearer auth route is already configured.

Keep the generated REVERB_APP_ID, REVERB_APP_KEY and REVERB_APP_SECRET. Set backend/.env:

```dotenv
ORDER_LIVE_ENABLED=true
BROADCAST_CONNECTION=reverb
REVERB_HOST=127.0.0.1
REVERB_PORT=8080
REVERB_SCHEME=http
```

Set frontend/.env.local (copy only the public key):

```dotenv
NEXT_PUBLIC_REVERB_APP_KEY=YOUR_GENERATED_PUBLIC_KEY
NEXT_PUBLIC_REVERB_HOST=127.0.0.1
NEXT_PUBLIC_REVERB_PORT=8080
NEXT_PUBLIC_REVERB_SCHEME=http
```

Never expose REVERB_APP_SECRET in frontend variables or Git. In config/reverb.php, restrict allowed_origins to frontend hostnames such as localhost and 127.0.0.1; remove wildcard origins before production.

Run php artisan config:clear. Restart Next.js after changing .env.local; rebuild for production.

## Processes

Keep the existing API and Next.js servers running. Open a backend terminal:

```powershell
php artisan reverb:start --host=127.0.0.1 --port=8080
```

In another backend terminal:

```powershell
php artisan queue:work order-mail --queue=live-updates,order-emails --tries=3 --backoff=5 --timeout=30
```

Stop the old email-only worker with Ctrl+C first. The new worker handles both queues. After code/config changes, queue:restart and reverb:restart stop the respective processes; start them again. An idle worker should stay open.

## Local validation

1. Customer dashboard should say Live updates connected.
2. In a staff browser, advance a test order to its next valid stage. The customer should see the update promptly, before the normal 15-second check. Verify the live-updates job completes.
3. Stop Reverb with Ctrl+C. The page should switch to automatic checks. A further change should appear within the next 15-second check plus request time.
4. Restart Reverb and confirm the subscription reconnects and fetches fresh data.
5. Test two customer accounts; each must see only its own orders/notifications. Sign-out must disconnect the subscription.

Automated tests cover authorization, empty private payloads, rollback, frontend auth headers, callbacks and cleanup. They do not prove real socket delivery. Until installed, keep ORDER_LIVE_ENABLED=false; polling remains available.

## Client devices and production

localhost/127.0.0.1 on a phone refer to the phone. Set API/frontend/public Reverb hostnames to a reachable test server or laptop LAN address; bind servers for LAN use and configure API CORS. For HTTPS deployments use secure wss/https with TLS proxying, restricted origins, disabled debug and supervised processes. Validate the actual client network before testing.

## Recovery

SMTP and live signals use different queue names. A transport outage releases jobs for retry while order changes and dashboard notices remain saved. After three failed attempts inspect php artisan queue:failed. Review failed live jobs before retrying/removing them; they contain only refresh signals. Do not blindly retry email jobs, which may send old messages. Periodic checks continue during Reverb outages. The order-mail connection uses the application database so queued signals roll back with transactions.
