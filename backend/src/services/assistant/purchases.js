/**
 * The "propose then human-confirmed execute" pattern for any assistant tool
 * that moves money. The LLM can only ever reach proposePurchase() (reads the
 * real catalog, writes a row, returns a token) — it has no path to
 * confirmPurchase(), which is the one function that actually calls
 * initiatePayment(). confirmPurchase() only runs from
 * POST /api/assistant/purchase/:token/confirm, which the mobile chat UI
 * calls when the person taps a "Confirm & Pay" button it rendered from the
 * proposal data — never automatically, never from model output.
 *
 * This is the general template for any future tool that changes state
 * (not just payments): propose tools are read-only and return a token;
 * execute only happens behind a human tap hitting a *separate*, non-tool
 * endpoint that re-validates the token server-side.
 */
import crypto from "crypto";
import { query } from "../../db/pool.js";
import { getPackageById } from "../catalog.js";
import { getSite } from "../sites.js";
import { resolveClientActivator } from "../activators.js";
import { createPendingSession } from "../sessions.js";
import { initiatePayment } from "../payments/index.js";
import { PAYMENT_PROVIDER } from "../../config.js";

const PROPOSAL_TTL_MS = 10 * 60 * 1000; // 10 minutes — see schema.sql's comment on assistant_purchase_proposals

/**
 * Called from the propose_mpesa_purchase tool. Read-only against the real
 * catalog/site — never touches payments or sessions. Returns a structured
 * proposal (package label/price straight from the DB, never from the
 * model's own text) plus a one-time token, or an error the model can relay
 * as-is (e.g. "this site doesn't sell packages").
 */
export async function proposePurchase({ mac, site, packageId, phone }) {
  if (!mac) return { ok: false, message: "No device identity for this chat — can't propose a purchase." };
  if (!phone || !/^\d{9,12}$/.test(phone)) {
    return { ok: false, message: "Need a valid phone number (digits only, e.g. 712345678) to propose a purchase." };
  }

  const pkg = await getPackageById(packageId);
  if (!pkg || !pkg.is_active) return { ok: false, message: `No active package with id "${packageId}".` };

  if (site) {
    const siteRow = await getSite(site);
    if (siteRow?.mode === "earn_only") return { ok: false, message: "This site does not sell packages." };
  }

  const token = crypto.randomUUID();
  await query(
    `INSERT INTO assistant_purchase_proposals (token, mac, site_id, package_id, phone, amount_kes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [token, mac, site || null, pkg.id, phone, pkg.price_kes]
  );

  return {
    ok: true,
    token,
    packageId: pkg.id,
    packageLabel: pkg.label,
    priceKes: Number(pkg.price_kes),
    durationSecs: pkg.duration_secs,
    phone,
  };
}

/**
 * The only function that actually calls initiatePayment() — reachable only
 * via the route, never via a tool. Re-reads the proposal row itself rather
 * than trusting anything the client sends beyond the token, and rejects a
 * reused or expired one.
 */
export async function confirmPurchase(token) {
  const { rows } = await query(`SELECT * FROM assistant_purchase_proposals WHERE token = $1`, [token]);
  const proposal = rows[0];
  if (!proposal) return { success: false, message: "Purchase proposal not found." };
  if (proposal.confirmed_at) return { success: false, message: "This purchase was already confirmed." };
  if (Date.now() - new Date(proposal.created_at).getTime() > PROPOSAL_TTL_MS) {
    return { success: false, message: "This purchase proposal expired — ask the assistant to propose it again." };
  }

  const resolvedActivatorId = await resolveClientActivator(proposal.mac, proposal.activator_code ?? undefined);

  const { reference, status, displayText } = await initiatePayment({
    phone: proposal.phone,
    amountKES: Number(proposal.amount_kes),
    metadata: { clientMac: proposal.mac, packageId: proposal.package_id, source: "assistant" },
  });

  const pkg = await getPackageById(proposal.package_id);
  await createPendingSession({
    reference,
    phone: proposal.phone,
    clientMac: proposal.mac,
    packageId: proposal.package_id,
    activatorId: resolvedActivatorId,
    amountKES: Number(proposal.amount_kes),
    paymentProvider: PAYMENT_PROVIDER,
    durationSecs: pkg?.duration_secs ?? 0,
    siteId: proposal.site_id,
  });

  await query(`UPDATE assistant_purchase_proposals SET confirmed_at = now(), session_reference = $2 WHERE token = $1`, [token, reference]);

  return { success: true, reference, provider: PAYMENT_PROVIDER, status, displayText };
}
