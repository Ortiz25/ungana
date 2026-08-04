import express from "express";
import cors from "cors";
import { PORT, APP_MODE, PAYMENT_PROVIDER, PAYSTACK_SECRET_KEY, DARAJA_CONSUMER_KEY } from "./config.js";
import { paymentsRouter } from "./routes/payments.js";
import { activatorsRouter } from "./routes/activators.js";
import { catalogRouter } from "./routes/catalog.js";
import { clientsRouter } from "./routes/clients.js";
import { retryPaidAuthorizations } from "./services/authorization.js";
import { login } from "./services/unifi.js";

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
app.use("/api/clients", clientsRouter);
app.use("/api/activators", activatorsRouter);

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
