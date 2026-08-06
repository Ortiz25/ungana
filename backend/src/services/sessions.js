import { query } from "../db/pool.js";
import { upsertClient, setClientUsername, lockClientActivator } from "./clients.js";

/**
 * Create the pending session row for a fresh payment attempt (or an earned
 * grant, which the caller marks 'success' immediately since no payment is
 * involved). This is the durable replacement for the reference backend's
 * in-memory `pendingPayments` Map.
 */
export async function createPendingSession({
  reference,
  phone,
  clientMac,
  packageId,
  activatorId,
  source = "purchase",
  amountKES,
  paymentProvider,
  durationSecs,
  username,
  amountSats, // BTC only — sats amount at invoice-creation time, for audit/reconciliation
  btcRateKes, // BTC only — KES/BTC rate at invoice-creation time, for audit/reconciliation
}) {
  const clientId = await upsertClient(clientMac, phone);
  // Throws (Postgres 23505) if `username` is already claimed by another
  // client — left to the caller to catch and turn into a 409.
  if (username) await setClientUsername(clientId, username);
  // No-op after the first purchase (see clients.activator_locked) — fixes
  // this client's commission attribution permanently, `activatorId` here
  // already having been resolved by resolveClientActivator() to whatever
  // is authoritative (the caller's request only matters the very first time).
  await lockClientActivator(clientId, activatorId ?? null);

  const { rows } = await query(
    `INSERT INTO sessions
       (reference, client_id, client_mac, package_id, activator_id, source,
        amount_kes, payment_provider, duration_secs, payment_status,
        amount_sats, btc_rate_kes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11)
     RETURNING *`,
    [
      reference,
      clientId,
      clientMac,
      packageId,
      activatorId,
      source,
      amountKES,
      paymentProvider,
      durationSecs,
      amountSats ?? null,
      btcRateKes ?? null,
    ]
  );

  await logPaymentEvent(rows[0].id, "initiated", { reference, phone, clientMac, packageId, amountKES });
  return rows[0];
}

export async function getSessionByReference(reference) {
  const { rows } = await query(`SELECT * FROM sessions WHERE reference = $1`, [reference]);
  return rows[0] || null;
}

/**
 * Most recent authorised session for a device, active or already expired —
 * for the live status endpoint, so the frontend can tell "session is still
 * running" apart from "session ended". Includes the client's phone for
 * restoring the session-summary display.
 */
export async function getLatestSessionForMac(mac) {
  const { rows } = await query(
    `SELECT s.*, c.phone AS client_phone
     FROM sessions s JOIN clients c ON c.id = s.client_id
     WHERE s.client_mac = $1 AND s.payment_status = 'success'
     ORDER BY s.authorized_at DESC NULLS LAST, s.created_at DESC
     LIMIT 1`,
    [mac.toLowerCase()]
  );
  return rows[0] || null;
}

/**
 * Same as `getLatestSessionForMac`, keyed by the client's self-chosen
 * username instead — the recovery path for a browser context that never
 * saw the router's MAC redirect (see the `clients.username` comment in
 * schema.sql). Deliberately no phone-based equivalent of this lookup.
 */
export async function getLatestSessionForUsername(username) {
  const { rows } = await query(
    `SELECT s.*, c.phone AS client_phone
     FROM sessions s JOIN clients c ON c.id = s.client_id
     WHERE c.username = $1 AND s.payment_status = 'success'
     ORDER BY s.authorized_at DESC NULLS LAST, s.created_at DESC
     LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

/**
 * Mark a session paid+authorised: computes commission (if referred by an
 * activator), stamps authorized_at/expires_at, and freezes commission_kes.
 */
export async function markSessionAuthorized(reference) {
  const { rows } = await query(
    `UPDATE sessions s
     SET payment_status = 'success',
         authorized_at = now(),
         expires_at = now() + make_interval(secs => s.duration_secs),
         commission_kes = ROUND(s.amount_kes * COALESCE(a.commission_rate, 0), 2)
     FROM (SELECT id, commission_rate FROM activators) a
     WHERE s.reference = $1 AND a.id = s.activator_id AND s.payment_status != 'success'
     RETURNING s.*`,
    [reference]
  );

  // No activator on the session (self-onboarded) — the FROM/JOIN above
  // finds no match, so update it separately without touching commission.
  if (rows.length === 0) {
    const { rows: plain } = await query(
      `UPDATE sessions
       SET payment_status = 'success',
           authorized_at = now(),
           expires_at = now() + make_interval(secs => duration_secs)
       WHERE reference = $1 AND payment_status != 'success'
       RETURNING *`,
      [reference]
    );
    if (plain[0]) await logPaymentEvent(plain[0].id, "authorized", { reference });
    return plain[0] || (await getSessionByReference(reference));
  }

  await logPaymentEvent(rows[0].id, "authorized", { reference });
  return rows[0];
}

/**
 * Provider confirmed the charge but router authorisation hasn't succeeded
 * yet. Distinct from 'success' so the retry sweep in server.js can find and
 * re-attempt these — the customer already paid and must never be dropped.
 */
export async function markSessionPaid(reference) {
  const { rows } = await query(
    `UPDATE sessions SET payment_status = 'paid' WHERE reference = $1 AND payment_status = 'pending' RETURNING *`,
    [reference]
  );
  if (rows[0]) await logPaymentEvent(rows[0].id, "paid", { reference });
  return rows[0] || null;
}

/** Sessions paid but not yet router-authorised — input to the retry sweep. */
export async function listPaidUnauthorizedSessions() {
  const { rows } = await query(`SELECT * FROM sessions WHERE payment_status = 'paid'`);
  return rows;
}

export async function markSessionFailed(reference, reason) {
  const { rows } = await query(
    `UPDATE sessions SET payment_status = 'failed' WHERE reference = $1 RETURNING *`,
    [reference]
  );
  if (rows[0]) await logPaymentEvent(rows[0].id, "auth_failed", { reference, reason });
  return rows[0] || null;
}

export async function logPaymentEvent(sessionId, eventType, payload) {
  await query(`INSERT INTO payment_events (session_id, event_type, payload) VALUES ($1, $2, $3)`, [
    sessionId,
    eventType,
    payload ? JSON.stringify(payload) : null,
  ]);
}

/** All sessions referred by an activator — newest first. */
export async function listSessionsForActivator(activatorId, limit = 100) {
  const { rows } = await query(
    `SELECT s.*, c.phone AS client_phone
     FROM sessions s JOIN clients c ON c.id = s.client_id
     WHERE s.activator_id = $1
     ORDER BY s.created_at DESC
     LIMIT $2`,
    [activatorId, limit]
  );
  return rows;
}
