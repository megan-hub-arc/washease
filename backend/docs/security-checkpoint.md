# Security checkpoint — October 13, 2026

## Recorded results

User dependency audits on the installed Windows system:
- Composer: no known advisories reported.
- npm production dependencies: zero findings after normal `npm audit fix`.
- npm full tree: five high-severity findings remain in the development-only
  braces / micromatch / fast-glob / Next ESLint chain. The braces advisory
  GHSA-vfj7-8cjw-p6xm lists no patched version at the time of review. This remains
  open; it is not a clean full audit. Do not force a downgrade to Next ESLint 14.
- User frontend lint and Next 16.3.8 production build passed after the update.

## Batch 34 behavior

Login: up to five requests per minute for the same normalized identifier and IP,
plus a ceiling of sixty requests per minute per IP across identifiers.
Registration: up to five requests per minute per IP. Successful and unsuccessful
requests both count. Exceeding a limit returns HTTP 429 with a readable message
and Retry-After header. Wait for the window to expire before retrying.

Limits are initial application settings, not a business priority rule. Shared
networks count toward the same IP allowance. At deployment, verify the actual
client IP with a controlled proxy configuration and use a persistent shared
cache. Do not blindly trust user-supplied forwarding headers. IP limits alone
are not comprehensive protection against distributed attacks.

## Test coverage

SecurityBoundaryTest covers missing/invalid tokens, customer and rider rejection
from staff lists and create actions, customer order/address list isolation and
foreign-record reads, unauthorized order status changes, logout token revocation
while preserving another device token, login limits/expiry/identifier rotation,
and registration limits/expiry with no accounts created while blocked.

Assistant: eight security cases passed; full suite passed with 60 tests and
489 assertions using PHP 8.5 and the repository's Laravel 13.32.0 locked packages.
A fresh test checkout needed its own local application key; no production data
or key was used. Re-run on the user's PHP 8.3 installation before accepting.

## Still pending

Production secret/history inspection, deployment configuration, remote HTTPS
verification, proxy/cache validation, browser security review, broader input and
output escaping checks, failure recovery and backup restoration. Passing these
unit/feature tests is not a complete penetration test or a security certification.

## Batch 35: deployment configuration preparation

API token expiration now defaults to 480 minutes from issuance (not idle time),
configurable with SANCTUM_EXPIRATION_MINUTES. Previously issued tokens older
than the window will also require signing in again. Logout still revokes the
current token. Expired token row cleanup remains a deployment scheduler task.

CORS defaults to http://localhost:3000 and http://127.0.0.1:3000 with Bearer
Authorization headers and no cookie credentials. Reverb defaults to localhost
and 127.0.0.1 hostnames. Neither accepts wildcard origin settings. These are
browser-origin controls, not substitutes for authentication or record ownership.

Proxy configuration defaults to no trusted proxies. TRUSTED_PROXIES accepts
verified IP addresses/CIDRs; wildcard and REMOTE_ADDR shortcuts are discarded.
Only forwarded IP, port and protocol are trusted from that list; forwarded host
is excluded. Hosting must restrict direct origin access and sanitize forwarding
headers. Real hosting-specific IP/proxy behavior still needs remote testing.

### Local application after applying the patch

Run `php artisan config:clear` and restart any long-running Reverb and queue
workers so they load the settings. Do not replace the existing .env file or
regenerate its APP_KEY. localhost and 127.0.0.1 browser origins work by default.

### Remote tunnel or production configuration

In backend .env set CORS_ALLOWED_ORIGINS to the exact frontend URL including
https://, and REVERB_ALLOWED_ORIGINS to that frontend hostname without scheme,
path or port. Use comma-separated entries if local access must also be allowed.
Use the frontend URL, not the API URL, for both browser-origin settings.
When a quick tunnel address changes these settings must be updated again.

For actual hosting also configure APP_ENV=production, APP_DEBUG=false,
APP_URL to the HTTPS API origin and FRONTEND_URL to the HTTPS frontend origin.
Set NEXT_PUBLIC_API_URL to the HTTPS API URL ending in /api before building
Next.js. Reverb browser connections use HTTPS/wss with the public host/port.
Keep REVERB_APP_SECRET and database/mail passwords exclusively in backend secrets.
Set TRUSTED_PROXIES only from the hosting provider's verified network design.
Keep a persistent cache (database or Redis) for limits and shared workers, then
cache configuration after verifying all settings. HTTPS, hosting provisioning,
queues, scheduler, secrets, backup restoration and production smoke tests remain
pending. This patch does not deploy the system.

Assistant verification: 67 tests, 511 assertions passed; Pint passed. The new
ProductionSecurityTest covers token expiry, allowed/rejected CORS preflight,
allowed/rejected Reverb origins, and trusted/untrusted forwarded IP/protocol/host.
Re-run on the user's PHP 8.3 installation and verify local browser login plus
live updates before committing. Assistant runtime used PHP 8.5.
