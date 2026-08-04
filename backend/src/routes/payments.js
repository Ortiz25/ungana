import { Router } from "express";
import { initiatePayment, checkPaymentStatus } from "../services/payments/index.js";
import { verifyPaystackSignature } from "../services/payments/paystack.js";
import {
  createPendingSession,
  getSessionByReference,
  getLatestSessionForMac,
  markSessionFailed,
} from "../services/sessions.js";
import { completeAuthorization } from "../services/authorization.js";
import { findActivatorByCode } from "../services/activators.js";
import { authorizeClient } from "../services/unifi.js";
import { PAYMENT_PROVIDER, ENABLE_TEST_ROUTE } from "../config.js";

export const paymentsRouter = Router();

/**
 * POST /api/initiate-payment
 * Body: { phoneNumber, clientMac, amount, packageId, activatorCode?, email?,
 *         duration?, durationSecs?, expire_number?, expire_unit?, data?, simulateFailure? }
 * `activatorCode` is the referral code chosen in the portal; omit or send
 * 'SELF' for a self-onboarded user (no activator credited).
 * `duration` is whole minutes (matches the UniFi voucher API); pass
 * `durationSecs` instead when you need sub-minute precision (e.g. the
 * frontend's accelerated demo timers) — it takes priority when present.
 * `simulateFailure` only has an effect when the server is running with
 * APP_MODE=simulation — it's ignored for real payments.
 */
paymentsRouter.post("/initiate-payment", async (req, res) => {
  const {
    phoneNumber,
    clientMac,
    amount,
    packageId,
    activatorCode,
    email,
    duration,
    durationSecs: durationSecsInput,
    expire_number,
    expire_unit,
    data,
    simulateFailure,
  } = req.body;

  if (!phoneNumber || !clientMac || !amount) {
    return res.status(400).json({ success: false, message: "phoneNumber, clientMac, and amount are required" });
  }

  try {
    const activator =
      activatorCode && activatorCode !== "SELF" ? await findActivatorByCode(activatorCode) : null;

    const { reference, status, displayText } = await initiatePayment({
      phone: phoneNumber,
      amountKES: amount,
      email,
      metadata: { clientMac, packageId, duration, data, expire_number, expire_unit },
      simulateFailure: !!simulateFailure,
    });

    const durationSecs = data ? 0 : Number.isFinite(durationSecsInput) ? durationSecsInput : (duration || 0) * 60;

    await createPendingSession({
      reference,
      phone: phoneNumber,
      clientMac,
      packageId,
      activatorId: activator?.id ?? null,
      amountKES: amount,
      paymentProvider: PAYMENT_PROVIDER,
      durationSecs,
    });

    console.log(`🔖 Pending session stored [${reference}] for MAC ${clientMac} via ${PAYMENT_PROVIDER}`);

    res.json({ success: true, reference, provider: PAYMENT_PROVIDER, status, displayText });
  } catch (error) {
    console.error("❌ Payment initiation error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
  }
});

/**
 * GET /api/verify-payment/:reference
 * Poll this from the frontend to check payment status; authorises on success.
 */
paymentsRouter.get("/verify-payment/:reference", async (req, res) => {
  const { reference } = req.params;

  try {
    let session = await getSessionByReference(reference);
    if (!session) return res.json({ success: false, status: "pending" });

    if (session.payment_status === "success") {
      return res.json({ success: true, status: "success", clientMac: session.client_mac });
    }

    // Already confirmed paid by the provider, just waiting on the router —
    // retry authorisation directly instead of re-querying the provider.
    if (session.payment_status === "paid") {
      const authorizedSession = await completeAuthorization(session);
      if (authorizedSession) {
        return res.json({ success: true, status: "success", clientMac: session.client_mac });
      }
      return res.status(503).json({
        success: false,
        status: "success",
        retrying: true,
        message: "Payment received. Activating your access — please wait…",
      });
    }

    const { status } = await checkPaymentStatus(reference);

    if (status === "success") {
      const authorizedSession = await completeAuthorization(session);
      if (authorizedSession) {
        return res.json({ success: true, status: "success", clientMac: session.client_mac });
      }
      return res.status(503).json({
        success: false,
        status: "success",
        retrying: true,
        message: "Payment received. Activating your access — please wait…",
      });
    }

    if (status === "failed") {
      await markSessionFailed(reference, "provider_reported_failed");
    }

    res.json({ success: false, status });
  } catch (error) {
    console.error("❌ Verify payment error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /api/webhook/paystack — charge.success events. */
paymentsRouter.post("/webhook/paystack", async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  if (!verifyPaystackSignature(req.rawBody, signature)) {
    console.warn("⚠️  Paystack webhook signature mismatch — ignoring");
    return res.status(401).send("Unauthorised");
  }

  const { event, data } = req.body;

  if (event === "charge.success" && data.status === "success") {
    const session = await getSessionByReference(data.reference);
    if (session && session.payment_status !== "success") {
      await completeAuthorization(session);
      console.log(`✅ Session ${data.reference} authorised via Paystack webhook`);
    }
  }

  res.sendStatus(200); // ack fast so Paystack doesn't retry
});

/** POST /api/webhook/daraja — Safaricom STK result callback. */
paymentsRouter.post("/webhook/daraja", async (req, res) => {
  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.json({ ResultCode: 0, ResultDesc: "Ignored" });

    const { CheckoutRequestID, ResultCode, ResultDesc } = callback;
    console.log(`📥 Daraja callback [${CheckoutRequestID}] ResultCode=${ResultCode} (${ResultDesc})`);

    if (String(ResultCode) === "0") {
      const session = await getSessionByReference(CheckoutRequestID);
      if (session && session.payment_status !== "success") {
        await completeAuthorization(session);
        console.log(`✅ Session ${CheckoutRequestID} authorised via Daraja callback`);
      }
    } else {
      await markSessionFailed(CheckoutRequestID, ResultDesc);
    }
  } catch (err) {
    console.error("❌ Daraja callback error:", err.message);
  }

  res.json({ ResultCode: 0, ResultDesc: "Accepted" }); // ack so Safaricom stops retrying
});

/**
 * GET /api/session/:mac
 * Latest session status for a device, read from our own DB. Distinguishes
 * "still active" from "found but expired" from "never had a session" so the
 * frontend can restore the right screen on load (timer vs. ended vs. the
 * normal start screen) instead of just a boolean.
 */
paymentsRouter.get("/session/:mac", async (req, res) => {
  try {
    const session = await getLatestSessionForMac(req.params.mac);
    if (!session) return res.json({ found: false, active: false, serverNow: Date.now() });

    const serverNow = Date.now();
    const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : null;
    const active = expiresAt === null || expiresAt > serverNow;

    res.json({
      found: true,
      active,
      type: session.package_id === "earned" ? "earned" : "time",
      expiresAt,
      durationSecs: session.duration_secs,
      packageId: session.package_id,
      phone: session.client_phone,
      serverNow,
    });
  } catch (error) {
    console.error("❌ Session status error:", error.message);
    res.status(500).json({ found: false, active: false, reason: "error", message: error.message });
  }
});

/** POST /api/auth — direct authorisation, bypassing payment (admin/manual use). */
paymentsRouter.post("/auth", async (req, res) => {
  const { clientMac, duration } = req.body;
  if (!clientMac) return res.status(400).json({ success: false, message: "Client MAC is required" });

  try {
    const authorized = await authorizeClient(clientMac, { duration });
    if (!authorized) return res.status(500).json({ success: false, message: "Authorization failed" });
    res.json({ success: true, message: "Client authorized", clientMac });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/test-authorize — dev-only dummy payment + authorise, so the
 * authorise-on-payment path can be verified without spending money. 403s
 * unless ENABLE_TEST_ROUTE=true. See ../../PAYMENTS.md for usage.
 */
paymentsRouter.get("/test-authorize", async (req, res) => {
  if (!ENABLE_TEST_ROUTE) return res.status(403).json({ success: false, message: "Test route disabled" });

  const {
    clientMac = "fa:16:9a:73:df:b8",
    phoneNumber = "254700000000",
    duration = 10,
    packageId = "test",
    amount = 5,
  } = req.body;

  try {
    const reference = `TEST-${Date.now()}`;
    const session = await createPendingSession({
      reference,
      phone: phoneNumber,
      clientMac,
      packageId,
      activatorId: null,
      amountKES: amount,
      paymentProvider: PAYMENT_PROVIDER,
      durationSecs: duration * 60,
    });

    const authorized = await completeAuthorization(session);
    res.json({ success: !!authorized, reference, clientMac });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
