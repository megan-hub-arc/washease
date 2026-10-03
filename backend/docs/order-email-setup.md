# Order email setup and client validation

Dashboard notices always work. Email is opt-in and is queued separately from SMTP delivery. Booking, stage changes, departure, payment changes, and requested-time edits use the saved event message. Customers without email receive dashboard notices only. No customer data is sent until a worker runs with email enabled.

## Safe local check (no real email sent)

In backend/.env set:

```dotenv
ORDER_EMAIL_ENABLED=true
FRONTEND_URL=http://localhost:3000
MAIL_MAILER=log
MAIL_FROM_ADDRESS=hello@example.com
MAIL_FROM_NAME=WashEase
```

From backend:

```powershell
php artisan config:clear
php artisan migrate
php artisan queue:work order-mail --queue=order-emails --timeout=30
```

Keep that terminal running. Use a customer with an email address. In another browser window, advance a test order to its next valid stage. Confirm its dashboard notice and look for the matching email subject and stage in backend/storage/logs/laravel.log. This verifies email generation, not inbox delivery. The email link must open your frontend customer page; login remains required.

## Real delivery

Configure MAIL_MAILER=smtp, MAIL_HOST, MAIL_PORT, MAIL_SCHEME, MAIL_USERNAME, MAIL_PASSWORD, and MAIL_FROM_ADDRESS using your provider's settings. Use a provider-approved sender. Keep credentials in .env and never commit or paste them into chat. Set FRONTEND_URL to the URL customers actually use. Run config:clear and restart the worker after changing settings. For production, keep the worker running under a process manager and disable APP_DEBUG.

Before client testing, verify an email arrives at an address you control (check spam), the order details match, and the link works on a phone. A successful SMTP handoff does not guarantee inbox delivery.

## Failure and recovery

The job gets three attempts with 30-second and 120-second retry delays. Staff order changes and dashboard notices remain saved during SMTP outages. Exhausted jobs appear in:

```powershell
php artisan queue:failed
```

Fix the mail settings, clear config, restart the worker, then retry only the affected ID:

```powershell
php artisan queue:retry FAILED_JOB_UUID
```

Do not blindly retry all jobs: queued emails contain the original event and recipient, so old messages may arrive late. SMTP delivery is at-least-once; a disconnect after acceptance can cause a duplicate on retry. Failed job payloads/exceptions contain personal data and may contain provider details: restrict database/log access and do not share them publicly. Email queue entries use the same application database so a rolled-back operation also removes its queued message. Do not change the order-mail connection to another database without revisiting that guarantee.

If turning email off after testing, stop the worker and inspect pending order-emails jobs before restarting it. The switch prevents new emails from being queued; it does not remove existing ones.

## Minimum client test evidence

Record booking, valid stage change, departure, payment, and time-edit notifications; one phone-only customer; no duplicate from saving unchanged payment; and an SMTP failure followed by a successful retry. Record expected result, actual result, tester, timestamp, and pass/fail. Use test orders and test mailboxes. Reverb WebSocket integration is still pending; the dashboard currently polls every 15 seconds.
