import { Router } from "express";
import { initiateBtcPayment, checkBtcPaymentStatus } from "../services/payments/btc.js";
import { verifyBtcpayWebhookSignature } from "../services/payments/btcpay.js";
import { createPendingSession, getSessionByReference, markSessionFailed } from "../services/sessions.js";
import { completeAuthorization } from "../services/authorization.js";
import { resolveClientActivator } from "../services/activators.js";
import { getPackageById } from "../services/catalog.js";
import { APP_MODE } from "../config.js";

export const btcRouter = Router();

/**
 * POST /api/initiate-btc-payment
 * Body: { clientMac, amount, packageId, activatorCode?, username?,
 *         durationSecs?, simulateFailure? }
 * No phone number — Lightning payments don't need one. `durationSecs` (the
 * frontend's accelerated demo timer) is only honoured without real BTCPay
 * credentials configured; in APP_MODE=active with BTCPAY_URL set, the
 * duration always comes from the `packages` catalog, same rule as the
 * M-Pesa flow — never trust a client-supplied duration for money that's
 * actually moving. `simulateFailure` only has an effect in that same
 * unconfigured/simulated case.
 */
btcRouter.post("/initiate-btc-payment", async (req, res) => {
  const { clientMac, amount, packageId, activatorCode, username, durationSecs: durationSecsInput, simulateFailure } =
    req.body;

  if (!clientMac || !amount || !packageId) {
    return res.status(400).json({ success: false, message: "clientMac, amount, and packageId are required" });
  }

  try {
    // Ignored entirely for a returning client with a locked assignment —
    // see resolveClientActivator's own comment.
    const resolvedActivatorId = await resolveClientActivator(clientMac, activatorCode);

    const { reference, lightningInvoice, checkoutLink, expiresAt, amountSats, btcRateKes } = await initiateBtcPayment({
      amountKES: amount,
      metadata: { clientMac, packageId },
      simulateFailure: !!simulateFailure,
    });

    let durationSecs;
    if (APP_MODE === "active") {
      const catalogPkg = await getPackageById(packageId);
      durationSecs = catalogPkg?.duration_secs ?? 0;
    } else {
      durationSecs = Number.isFinite(durationSecsInput) ? durationSecsInput : 0;
    }

    await createPendingSession({
      reference,
      phone: null,
      clientMac,
      packageId,
      activatorId: resolvedActivatorId,
      amountKES: amount,
      paymentProvider: "btcpay",
      durationSecs,
      username: username || undefined,
      amountSats,
      btcRateKes,
    });

    console.log(`⚡ Pending BTC session stored [${reference}] for MAC ${clientMac}`);

    res.json({ success: true, reference, lightningInvoice, checkoutLink, expiresAt });
  } catch (error) {
    if (error.code === "23505" && error.constraint?.includes("username")) {
      return res.status(409).json({ success: false, message: "That username is already taken — try another." });
    }
    console.error("❌ BTC payment initiation error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
  }
});

/**
 * GET /api/verify-btc-payment/:reference
 * Poll this from the frontend to check invoice status; authorises on Settled.
 */
btcRouter.get("/verify-btc-payment/:reference", async (req, res) => {
  const { reference } = req.params;

  try {
    const session = await getSessionByReference(reference);
    if (!session) return res.json({ success: false, status: "pending" });

    if (session.payment_status === "success") {
      return res.json({ success: true, status: "success", clientMac: session.client_mac });
    }

    // Already confirmed paid, just waiting on the router — retry directly
    // instead of re-querying BTCPay.
    if (session.payment_status === "paid") {
      const authorizedSession = await completeAuthorization(session);
      if (authorizedSession) return res.json({ success: true, status: "success", clientMac: session.client_mac });
      return res.status(503).json({
        success: false,
        status: "success",
        retrying: true,
        message: "Payment received. Activating your access — please wait…",
      });
    }

    const { status } = await checkBtcPaymentStatus(reference);

    if (status === "Settled") {
      const authorizedSession = await completeAuthorization(session);
      if (authorizedSession) return res.json({ success: true, status: "success", clientMac: session.client_mac });
      return res.status(503).json({
        success: false,
        status: "success",
        retrying: true,
        message: "Payment received. Activating your access — please wait…",
      });
    }

    if (status === "Expired" || status === "Invalid") {
      await markSessionFailed(reference, `btcpay_${status.toLowerCase()}`);
      return res.json({ success: false, status: "failed" });
    }

    res.json({ success: false, status: "pending" });
  } catch (error) {
    console.error("❌ BTC verify payment error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /api/webhook/btcpay — BTCPay event delivery (InvoiceSettled, InvoiceExpired, InvoiceInvalid). */
btcRouter.post("/webhook/btcpay", async (req, res) => {
  const signature = req.headers["btcpay-sig"];
  if (!verifyBtcpayWebhookSignature(req.rawBody, signature)) {
    console.warn("⚠️  BTCPay webhook signature mismatch — ignoring");
    return res.status(401).send("Unauthorised");
  }

  const { type, invoiceId } = req.body;

  if (type === "InvoiceSettled") {
    const session = await getSessionByReference(invoiceId);
    if (session && session.payment_status !== "success") {
      await completeAuthorization(session);
      console.log(`✅ BTC session ${invoiceId} authorised via webhook`);
    }
  } else if (type === "InvoiceExpired" || type === "InvoiceInvalid") {
    await markSessionFailed(invoiceId, type);
  }

  res.sendStatus(200); // ack so BTCPay doesn't retry
});
