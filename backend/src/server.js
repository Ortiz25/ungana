import express from "express";
import cors from "cors";
import {
  PORT,
  APP_MODE,
  PAYMENT_PROVIDER,
  PAYSTACK_SECRET_KEY,
  DARAJA_CONSUMER_KEY,
  BTCPAY_URL,
  BTCPAY_API_KEY,
  BTCPAY_STORE_ID,
} from "./config.js";
import { paymentsRouter } from "./routes/payments.js";
import { activatorsRouter } from "./routes/activators.js";
import { coordinatorsRouter } from "./routes/coordinators.js";
import { catalogRouter } from "./routes/catalog.js";
import { clientsRouter } from "./routes/clients.js";
import { btcRouter } from "./routes/btc.js";
import { contentRouter } from "./routes/content.js";
import { adminRouter } from "./routes/admin.js";
import { retryPaidAuthorizations } from "./services/authorization.js";
import { login } from "./services/unifi.js";
import { UPLOADS_DIR } from "./services/uploads.js";

if (APP_MODE === "active") {
  const missingCreds =
    (PAYMENT_PROVIDER === "paystack" && !PAYSTACK_SECRET_KEY) ||
    (PAYMENT_PROVIDER === "daraja" && !DARAJA_CONSUMER_KEY);
  if (missingCreds) {
    console.warn(
      `⚠️  APP_MODE=active but no credentials found for PAYMENT_PROVIDER=${PAYMENT_PROVIDER} — ` +
        `real payment calls will fail until .env is filled in (see PAYMENTS.md).`
    );
  }
  // BTC is a parallel, optional checkout method — only warn if it looks
  // half-configured (BTCPAY_URL set but the rest missing), not if it's
  // simply not set up yet (BTC checkout then just uses simulated invoices).
  if (BTCPAY_URL && (!BTCPAY_API_KEY || !BTCPAY_STORE_ID)) {
    console.warn("⚠️  BTCPAY_URL is set but BTCPAY_API_KEY/BTCPAY_STORE_ID are missing — BTC checkout will use simulated invoices until .env is complete.");
  }
}

const app = express();
app.use(cors());

// Capture the raw body alongside the parsed one — Paystack's webhook
// signature is computed over the exact bytes they sent, and re-serialising
// req.body with JSON.stringify is not guaranteed to match byte-for-byte.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get("/api", (_req, res) => {
  res.json({ message: "Ungana Hotspot Server Running", mode: APP_MODE, paymentProvider: PAYMENT_PROVIDER });
});

app.use("/api", paymentsRouter);
app.use("/api", catalogRouter);
app.use("/api", btcRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/activators", activatorsRouter);
app.use("/api/coordinators", coordinatorsRouter);
app.use("/api/content", contentRouter);
app.use("/api/admin", adminRouter);
app.use("/uploads", express.static(UPLOADS_DIR));

// ── Background retry sweep ────────────────────────────────────────────────
// Re-attempts router authorisation for payments that succeeded but whose
// authorisation failed (e.g. the controller was briefly unreachable). This
// guarantees a paying customer eventually gets online even if they closed
// the portal before the controller came back.
const RETRY_SWEEP_MS = 30_000;
setInterval(() => {
  retryPaidAuthorizations().catch((err) => console.error("❌ Retry sweep crashed:", err.message));
}, RETRY_SWEEP_MS);

login()

app.listen(PORT, () =>
  console.log(`🚀 Ungana backend running on port ${PORT} — mode: ${APP_MODE}, payment provider: ${PAYMENT_PROVIDER}`)
);
