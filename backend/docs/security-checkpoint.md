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
