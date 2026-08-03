# Ungana

A WiFi hotspot captive portal for the Kenyan market — pay-as-you-go and
watch-to-earn internet access, with referral agents ("activators") who earn
commission on the users they bring in.

## Layout

```
frontend/   SvelteKit + Svelte 5 SPA — the portal UI (see frontend/README.md)
backend/    Express + PostgreSQL API — payments, sessions, activators (see backend/README.md)
PAYMENTS.md M-Pesa payment provider setup (Paystack / Daraja), shared by both
```

## Run locally

```bash
# backend
cd backend
npm install
cp .env.example .env      # DATABASE_URL, APP_MODE=simulation is the safe default
npm run db:migrate
npm run db:seed           # optional demo activators (PIN 1234)
npm run dev                # http://localhost:5000

# frontend, in a second terminal
cd frontend
npm install
npm run dev                # http://localhost:5173
```

The frontend calls the backend over HTTP and falls back to its own static
demo data whenever the backend is unreachable, so `npm run dev` in
`frontend/` alone (no backend running) still works as a standalone demo.

See `frontend/README.md` and `backend/README.md` for details specific to
each half.
