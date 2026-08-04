# Ungana backend

Express + PostgreSQL backend for the Ungana captive portal: handles M-Pesa
STK-push payments (Paystack or Daraja), records every client session, and
authorises the device on your router (UniFi by default) once payment is
confirmed.

Payment-provider setup (Paystack vs Daraja credentials, webhooks, testing)
is documented in **[`../PAYMENTS.md`](../PAYMENTS.md)** — this README only
covers running the server and the database.

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`: at minimum `DATABASE_URL`, a `PAYMENT_PROVIDER` + its
credentials (see `PAYMENTS.md`), and the `UNIFI_*` vars if you're
authorising against a real controller. Leave `UNIFI_URL` unset to run
without a router — sessions are still recorded, just not authorised on a
device.

### Simulation vs active mode

`APP_MODE` controls whether payments are real:

| `APP_MODE`     | Behaviour                                                                 |
|----------------|-----------------------------------------------------------------------------|
| `simulation` *(default)* | No network call to Paystack/Daraja — `/api/initiate-payment` resolves locally after ~3s. Pass `"simulateFailure": true` in the request body to force a declined outcome (mirrors the frontend's PaymentScreen demo toggle). Safe for dev/demo — no money moves, no provider credentials required. |
| `active`       | Real STK push via the configured `PAYMENT_PROVIDER`. Requires valid credentials — the server warns on startup if they're missing. |

**`APP_MODE` only affects the payment gateway call.** Router authorisation
(`services/unifi.js`) is unconditional — once a session's payment resolves
to `success` (real or simulated), the backend still logs into `UNIFI_URL`
and creates/authorises a real voucher if it's configured. Unset `UNIFI_URL`
to test payments without touching a real console.

The default is `simulation` so a blank/misconfigured `.env` can never
accidentally trigger a real charge — you have to opt in explicitly.

## Database

Requires PostgreSQL 13+ (uses `gen_random_uuid()` from `pgcrypto`).

```bash
createdb ungana                # or use an existing database
npm run db:migrate             # applies backend/src/db/schema.sql
npm run db:seed                # optional — seeds demo activators (PIN 1234)
```

`schema.sql` is safe to re-run — every statement uses `IF NOT EXISTS` /
`ON CONFLICT DO NOTHING`.

### Tables

| Table            | Purpose                                                                 |
|-------------------|--------------------------------------------------------------------------|
| `packages`        | Plan catalogue (price, duration) — mirrors `PACKAGES` in the frontend.  |
| `activators`      | Referral agents: login credentials, territory, commission rate.        |
| `clients`         | End-user devices, keyed by MAC address (phone is a secondary, last-used attribute). |
| `sessions`        | One row per payment attempt / access window — the durable record behind `/api/verify-payment`, both webhooks, and the activator dashboards. |
| `payment_events`  | Raw audit log (webhook/poll/authorise outcomes) per session.           |

`activator_earnings` is a view summarising paid sessions + commission per
activator.

## Run

```bash
npm run dev     # node --watch
# or
npm start
```

```
🚀 Ungana backend running on port 5000 — payment provider: paystack
```

## API

| Method & path                         | Purpose                                                      |
|-----------------------------------------|----------------------------------------------------------------|
| `GET  /api`                            | Health check.                                                 |
| `GET  /api/packages`                   | Public plan catalogue (id, label, price, duration).            |
| `GET  /api/activators`                 | Public referral picker list (code, name, territory only — no phone/PIN). |
| `POST /api/initiate-payment`           | Start an STK push; creates a `pending` session.                |
| `GET  /api/verify-payment/:reference`  | Poll payment status; authorises the router on success.        |
| `GET  /api/session/:mac`               | Live session status for a device (from the DB).                |
| `POST /api/webhook/paystack`           | Paystack `charge.success` callback (signature-verified).       |
| `POST /api/webhook/daraja`             | Safaricom STK result callback.                                 |
| `POST /api/auth`                       | Direct router authorisation, bypassing payment (admin/manual). |
| `POST /api/test-authorize`             | Dev-only dummy payment + authorise. Needs `ENABLE_TEST_ROUTE=true`. |
| `POST /api/activators/login`           | Body `{ phone, pin }` → `{ token, activator }`.                |
| `GET  /api/activators/me/sessions`     | Bearer-token protected — sessions referred by the logged-in activator. |
| `GET  /api/activators/me/earnings`     | Bearer-token protected — paid-session count, gross + commission totals. |

`POST /api/initiate-payment` body:

```json
{
  "phoneNumber": "0722000000",
  "clientMac": "aa:bb:cc:dd:ee:ff",
  "amount": 50,
  "packageId": "daily",
  "activatorCode": "ACT-001",
  "duration": 1440,
  "simulateFailure": false
}
```

`activatorCode` is optional — omit it or send `"SELF"` for a self-onboarded
user (no commission credited). `duration` is in minutes. `simulateFailure`
only has an effect when `APP_MODE=simulation`.
