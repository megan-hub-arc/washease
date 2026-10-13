# Northflank evaluation deployment

This container is a candidate for the free capstone evaluation environment, not a claim of verified hosting or business production readiness. No paid resource or dependency change is required by these files.

## Build configuration

- Combined service: `washease-backend`, repository `megan-hub-arc/washease`, branch `main`.
- Docker build context: `/backend`; Dockerfile location: `/backend/Dockerfile` (repository-relative).
- One instance. Inspect free compute options before creating. 256 MB has not been verified sufficient for Apache, queue and Reverb together.
- Public HTTP port 8080 for the API; public HTTP/WebSocket port 8081 for Reverb. Northflank must provide HTTPS endpoints for both. Database remains private.
- Readiness HTTP GET `/up` on 8080 checks application boot; it does not prove database, queue or WebSocket health.

## Runtime secrets and settings

Supply values through Northflank runtime variables or linked addon secrets. Never commit passwords, keys, certificates, production `.env`, or SQL exports.

- `APP_KEY`: generate once and preserve through redeploys; never regenerate on startup.
- `APP_URL`: actual HTTPS API base URL.
- `DB_HOST`, `DB_PORT` (usually 3306), `DB_DATABASE=washease`, `DB_USERNAME`, `DB_PASSWORD`: private addon connection details.
- `MYSQL_SSL_CA_BASE64`: base64 encoding of the addon CA certificate downloaded from Northflank. Startup decodes it outside the public directory; PDO uses it to verify the MySQL TLS connection. Do not turn certificate verification off to resolve failures.
- `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`: stable generated credentials. Only the key may be public in frontend settings.
- `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`: actual frontend HTTPS origin, including scheme.
- `REVERB_ALLOWED_ORIGINS`: frontend hostname only, without scheme or path.
- `TRUSTED_PROXIES`: only provider-verified proxy addresses/CIDRs. No wildcard. Verify actual client IP and HTTPS behavior before accepting rate-limit behavior behind the platform.
- `ORDER_LIVE_ENABLED=true` once queue and WebSocket tests pass; `ORDER_EMAIL_ENABLED=false` until a real mail transport is configured and tested.
- `SANCTUM_EXPIRATION_MINUTES=480`.

The entrypoint enforces production/debug-off, database queue/cache/session, stderr logging, and server-side broadcasts to local Reverb port 8081. Browser Reverb settings instead use its public HTTPS hostname and port 443.

## Initial release

1. Build and deploy with secrets; use the service console to run `php artisan migrate --force --no-interaction` once against the new evaluation database. Do not run `migrate:fresh`.
2. Restart the service after migrations, then create/import only approved fictional or anonymized evaluation records. Do not blindly import the full local database.
3. Configure frontend production API URL with `/api`, public Reverb key/hostname, scheme `https`, port `443`; rebuild frontend when public build settings change.

Apache serves only `public/`. Supervisor restarts queue/Reverb processes. Local files in the container are ephemeral; current data persists in MySQL, not the container. Persistent uploads would require a separate confirmed storage plan. Backup/export and restoration remain required before evaluation.

## Verification still required

Docker is unavailable in the preparation environment: the image build, Apache configuration under the image, real MySQL TLS, deployment memory use, proxy forwarding, HTTPS, queue delivery, WebSockets, and restart recovery must be tested on Northflank. Passing Laravel tests is not a container smoke test. Existing development-only dependency findings remain unresolved.
