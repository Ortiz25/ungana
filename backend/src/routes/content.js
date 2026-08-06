import { Router } from "express";
import {
  listActiveContent,
  getClientCompletions,
  recordCompletion,
  claimUnclaimedCompletions,
  attachClaimedSession,
} from "../services/content.js";
import { upsertClient } from "../services/clients.js";
import { createPendingSession } from "../services/sessions.js";
import { completeAuthorization } from "../services/authorization.js";
import { resolveClientActivator } from "../services/activators.js";

export const contentRouter = Router();

/** GET /api/content — public catalogue for the Watch & Earn screen. */
contentRouter.get("/", async (_req, res) => {
  try {
    const items = await listActiveContent();
    res.json({ items });
  } catch (error) {
    console.error("❌ Content catalogue error:", error.message);
    res.status(500).json({ items: [], message: error.message });
  }
});

/** GET /api/content/completions?mac=X — items this device has already finished, for UI restore after reload. */
contentRouter.get("/completions", async (req, res) => {
  const { mac } = req.query;
  if (!mac) return res.status(400).json({ completions: [], message: "mac is required" });

  try {
    const completions = await getClientCompletions(mac);
    res.json({ completions });
  } catch (error) {
    console.error("❌ Content completions error:", error.message);
    res.status(500).json({ completions: [], message: error.message });
  }
});

/**
 * POST /api/content/:id/complete — Body: { mac, elapsedSecs, response }.
 * Server-authoritative reward crediting; see services/content.js for the
 * dwell-time / survey-response validation this enforces.
 */
contentRouter.post("/:id/complete", async (req, res) => {
  const { mac, elapsedSecs, response } = req.body;
  if (!mac) return res.status(400).json({ ok: false, message: "mac is required" });

  const contentItemId = Number(req.params.id);
  if (!Number.isInteger(contentItemId)) return res.status(400).json({ ok: false, message: "invalid content id" });

  try {
    const result = await recordCompletion(mac, contentItemId, { elapsedSecs: Number(elapsedSecs) || 0, response });
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    console.error("❌ Content completion error:", error.message);
    res.status(500).json({ ok: false, message: error.message });
  }
});

/**
 * POST /api/content/claim-earned-session — Body: { mac }.
 * Sums every unclaimed completion's earn_secs for this device, creates a
 * `source: 'earned'` session for the total, and runs it through the same
 * real UniFi-authorise path a paid session uses (services/authorization.js)
 * — this is what actually grants internet for watch-to-earn, replacing the
 * frontend's old fabricated-package/no-backend-call shortcut. Like a paid
 * session, if the router is briefly unreachable the session is left 'paid'
 * for the background retry sweep in server.js to pick up — the client's
 * earned time is never lost, just delayed.
 */
contentRouter.post("/claim-earned-session", async (req, res) => {
  const { mac } = req.body;
  if (!mac) return res.status(400).json({ success: false, message: "mac is required" });

  try {
    const clientId = await upsertClient(mac);
    const { ids, totalSecs } = await claimUnclaimedCompletions(clientId);

    if (totalSecs <= 0) {
      return res.status(400).json({ success: false, message: "No unclaimed earned time available" });
    }

    // No activator prompt on the Watch & Earn flow — undefined resolves to
    // this client's already-locked activator if it has one, else self-onboarded.
    const resolvedActivatorId = await resolveClientActivator(mac, undefined);
    const reference = `EARNED-${Date.now()}-${clientId}`;

    const session = await createPendingSession({
      reference,
      phone: null,
      clientMac: mac,
      packageId: "earned",
      activatorId: resolvedActivatorId,
      source: "earned",
      amountKES: 0,
      paymentProvider: null,
      durationSecs: totalSecs,
    });

    // Link before authorising so these completions can never be claimed a
    // second time, regardless of whether router authorisation succeeds now
    // or only later via the retry sweep.
    await attachClaimedSession(ids, session.id);

    const authorizedSession = await completeAuthorization(session);
    if (authorizedSession) {
      return res.json({ success: true, status: "success", clientMac: mac, durationSecs: totalSecs });
    }

    res.status(503).json({
      success: false,
      status: "success",
      retrying: true,
      durationSecs: totalSecs,
      message: "Access granted. Activating your session — please wait…",
    });
  } catch (error) {
    console.error("❌ Claim earned session error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});
