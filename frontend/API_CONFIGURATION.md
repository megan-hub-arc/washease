# API configuration

By default, the frontend connects to `http://127.0.0.1:8000/api`.
For testing from another device, create `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://YOUR_BACKEND_LAN_IP:8000/api
```

Include `/api`. Use the backend address reachable from the testing device.
Restart the frontend development server after changing this value. For production,
set it before `npm run build` and rebuild when it changes. This is a public URL;
never put credentials in it.

The backend must also listen on an accessible interface and allow the frontend's
origin through CORS. Use HTTPS for a publicly hosted frontend and backend.

# Batch 13 verification status

Baseline reviewed: `develop` at `c31a71e` on October 3, 2026.

- Batch 11 code exists: zone create/update, active status, address listing and assignment.
- Batch 12 code exists: customers, riders, payments, reports and service settings.
- Baseline frontend lint, TypeScript and production build passed.
- Stabilization changes: one configurable API URL for all frontend requests;
  reject blank or non-finite service rates while allowing an explicit zero.
- Backend runtime and end-to-end checks remain unverified. PHP and Composer are
  unavailable in the review environment; remote installer execution was blocked.

## Remaining checks with Laravel running

1. Run `php artisan route:list --path=api/staff/addresses` and `php artisan test`.
2. Verify unauthenticated API access is rejected; customers cannot access staff
   addresses, zones, customers, riders, reports or service management.
3. Create a customer address, assign an active zone, and create a booking using
   an active service. Confirm it appears in both customer history and staff orders.
4. Follow the supported order transitions, record weight and payment, schedule
   delivery, and assign a rider. Confirm capacity and duplicate assignment rules.
5. Complete delivery and verify customer status, payment totals and reports.
6. Visit every staff navigation destination; verify customer/staff redirects,
   logout, and invalid/expired tokens.
7. Test from a second device using the configured backend URL.

These checks require test data and an isolated database. Existing example tests
alone do not establish that the full laundry workflow works.
