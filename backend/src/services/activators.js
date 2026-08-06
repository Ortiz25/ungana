import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
import { getClientByMac } from "./clients.js";
import { normalizeKEPhone } from "../utils/phone.js";

export async function findActivatorByCode(code) {
  const { rows } = await query(`SELECT * FROM activators WHERE code = $1 AND status = 'active'`, [code]);
  return rows[0] || null;
}

/**
 * Which activator (if any) should be credited for a purchase from this MAC.
 * If the client already has a locked assignment (from an earlier purchase —
 * including a locked "self-onboarded", i.e. activator_id NULL), that's
 * authoritative and `requestedCode` is ignored entirely: an activator
 * assignment is permanent once set, by design (commission integrity — see
 * schema.sql). Only for a genuinely first-time client (no locked row yet)
 * does `requestedCode` get resolved and, moments later in
 * createPendingSession, locked in as that client's permanent assignment.
 */
export async function resolveClientActivator(macAddress, requestedCode) {
  const client = await getClientByMac(macAddress);
  if (client?.activator_locked) return client.activator_id;

  if (!requestedCode || requestedCode === "SELF") return null;
  const activator = await findActivatorByCode(requestedCode);
  return activator?.id ?? null;
}

export async function findActivatorByPhone(phone) {
  const { rows } = await query(`SELECT * FROM activators WHERE phone = $1 AND status = 'active'`, [
    normalizeKEPhone(phone),
  ]);
  return rows[0] || null;
}

/** Verify a login PIN against the stored hash. Returns the activator row or null. */
export async function verifyActivatorLogin(phone, pin) {
  const activator = await findActivatorByPhone(phone);
  if (!activator) return null;
  const ok = await bcrypt.compare(pin, activator.pin_hash);
  return ok ? activator : null;
}

/** Create an activator with a hashed PIN (admin/onboarding use). */
export async function createActivator({ code, name, phone, pin, territory, mpesaNumber, commissionRate = 0.2, coordinatorId }) {
  const pinHash = await bcrypt.hash(pin, 10);
  const { rows } = await query(
    `INSERT INTO activators (code, name, phone, pin_hash, territory, mpesa_number, commission_rate, coordinator_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, code, name, phone, territory, mpesa_number, commission_rate, status, coordinator_id, created_at`,
    [code, name, normalizeKEPhone(phone), pinHash, territory ?? null, mpesaNumber ?? null, commissionRate, coordinatorId ?? null]
  );
  return rows[0];
}

/** Earnings summary for one activator (backed by the activator_earnings view). */
export async function getActivatorEarnings(activatorId) {
  const { rows } = await query(`SELECT * FROM activator_earnings WHERE id = $1`, [activatorId]);
  return rows[0] || null;
}

// ── Admin CRUD ───────────────────────────────────────────────────────────

/** Every activator with its coordinator's name and live performance numbers, for the admin panel. */
export async function adminListActivators() {
  const { rows } = await query(
    `SELECT a.id, a.code, a.name, a.phone, a.territory, a.mpesa_number, a.commission_rate, a.status,
            a.coordinator_id, co.name AS coordinator_name, a.created_at,
            COALESCE(ae.paid_sessions, 0)   AS paid_sessions,
            COALESCE(ae.gross_kes, 0)       AS gross_kes,
            COALESCE(ae.commission_kes, 0)  AS commission_kes
     FROM activators a
     LEFT JOIN coordinators co ON co.id = a.coordinator_id
     LEFT JOIN activator_earnings ae ON ae.id = a.id
     ORDER BY a.created_at DESC`
  );
  return rows;
}

const ACTIVATOR_FIELD_COLUMNS = {
  name: "name",
  territory: "territory",
  mpesaNumber: "mpesa_number",
  commissionRate: "commission_rate",
  status: "status",
  coordinatorId: "coordinator_id",
};

/**
 * Partial update — only fields present in `fields` are touched. `pin`, if
 * given, is hashed and applied alongside any other fields in the same
 * statement. Returns null if the id doesn't exist.
 */
export async function updateActivator(id, fields) {
  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(ACTIVATOR_FIELD_COLUMNS)) {
    if (fields[key] === undefined) continue;
    sets.push(`${column} = $${sets.length + 1}`);
    values.push(fields[key]);
  }

  if (fields.pin) {
    const pinHash = await bcrypt.hash(fields.pin, 10);
    sets.push(`pin_hash = $${sets.length + 1}`);
    values.push(pinHash);
  }

  if (sets.length === 0) {
    const { rows } = await query(`SELECT * FROM activators WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  values.push(id);
  const { rows } = await query(
    `UPDATE activators SET ${sets.join(", ")} WHERE id = $${values.length}
     RETURNING id, code, name, phone, territory, mpesa_number, commission_rate, status, coordinator_id`,
    values
  );
  return rows[0] || null;
}
