// Centralised env config — see backend/.env.example for every variable and
// ../PAYMENTS.md at the repo root for how to obtain the payment credentials.
//
// Resolve .env relative to this file (backend/.env), not the process's
// working directory — `dotenv/config`'s default lookup is CWD-relative, so
// starting the server from anywhere other than backend/ (a different CWD,
// a process manager, a monorepo script) would silently skip .env, leaving
// DATABASE_URL undefined and producing a confusing SASL/auth error from pg
// rather than a clear "config missing" one.
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

export const PORT = process.env.PORT || 5000;

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
export const ENABLE_TEST_ROUTE = process.env.ENABLE_TEST_ROUTE === "true";

// ── App mode ────────────────────────────────────────────────────────────
// 'simulation' (default, safe): no real STK push is sent — payments resolve
//   locally after a short delay, honouring an optional `simulateFailure`
//   flag from the request (mirrors the frontend's PaymentScreen demo toggle).
// 'active': real STK push via the configured PAYMENT_PROVIDER — actual
//   money moves. Defaults to 'simulation' so a misconfigured .env can never
//   accidentally charge a real card/M-Pesa account.
const rawAppMode = (process.env.APP_MODE || "simulation").toLowerCase();
export const APP_MODE = rawAppMode === "active" ? "active" : "simulation";
if (rawAppMode !== APP_MODE) {
  console.warn(`⚠️  Unknown APP_MODE "${rawAppMode}" — falling back to "simulation"`);
}

// ── UniFi controller (router-side authorisation) ──────────────────────────
export const UNIFI_URL = process.env.UNIFI_URL;
export const UNIFI_SITE = process.env.UNIFI_SITE;
export const UNIFI_USERNAME = process.env.UNIFI_USERNAME;
export const UNIFI_PASSWORD = process.env.UNIFI_PASSWORD;

// ── Payment provider selection ─────────────────────────────────────────────
export const PAYMENT_PROVIDER = (process.env.PAYMENT_PROVIDER || "paystack").toLowerCase();

// ── Paystack ────────────────────────────────────────────────────────────
export const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
export const PAYSTACK_EMAIL = process.env.PAYSTACK_EMAIL;

// ── Daraja (Safaricom M-Pesa) ───────────────────────────────────────────
export const DARAJA_ENV = (process.env.DARAJA_ENV || "sandbox").toLowerCase();
export const DARAJA_CONSUMER_KEY = process.env.DARAJA_CONSUMER_KEY;
export const DARAJA_CONSUMER_SECRET = process.env.DARAJA_CONSUMER_SECRET;
export const DARAJA_SHORTCODE = process.env.DARAJA_SHORTCODE;
export const DARAJA_PASSKEY = process.env.DARAJA_PASSKEY;
export const DARAJA_TRANSACTION_TYPE = process.env.DARAJA_TRANSACTION_TYPE || "CustomerPayBillOnline";
export const DARAJA_CALLBACK_URL = process.env.DARAJA_CALLBACK_URL;
export const DARAJA_ACCOUNT_REF = process.env.DARAJA_ACCOUNT_REF || "HOTSPOT";
export const DARAJA_BASE_URL =
  DARAJA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
