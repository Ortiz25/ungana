import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
import { normalizeKEPhone } from "../utils/phone.js";

export async function findCoordinatorByPhone(phone) {
  const { rows } = await query(`SELECT * FROM coordinators WHERE phone = $1 AND status = 'active'`, [
    normalizeKEPhone(phone),
  ]);
  return rows[0] || null;
}

/** Verify a coordinator login PIN against the stored hash. Returns the coordinator row or null. */
export async function verifyCoordinatorLogin(phone, pin) {
  const coordinator = await findCoordinatorByPhone(phone);
  if (!coordinator) return null;
  const ok = await bcrypt.compare(pin, coordinator.pin_hash);
  return ok ? coordinator : null;
}

/** Earnings rollup for one coordinator (backed by the coordinator_earnings view). */
export async function getCoordinatorEarnings(coordinatorId) {
  const { rows } = await query(`SELECT * FROM coordinator_earnings WHERE id = $1`, [coordinatorId]);
  return rows[0] || null;
}

/** Activators reporting to this coordinator, with their own performance — for the coordinator's own "my team" view. */
export async function getActivatorsForCoordinator(coordinatorId) {
  const { rows } = await query(
    `SELECT a.id, a.code, a.name, a.territory, a.status,
            COALESCE(ae.paid_sessions, 0)  AS paid_sessions,
            COALESCE(ae.gross_kes, 0)      AS gross_kes,
            COALESCE(ae.commission_kes, 0) AS commission_kes
     FROM activators a
     LEFT JOIN activator_earnings ae ON ae.id = a.id
     WHERE a.coordinator_id = $1
     ORDER BY a.name`,
    [coordinatorId]
  );
  return rows;
}

/** Create a coordinator with a hashed PIN (admin/onboarding use). */
export async function createCoordinator({ name, phone, pin, territory }) {
  const pinHash = await bcrypt.hash(pin, 10);
  const { rows } = await query(
    `INSERT INTO coordinators (name, phone, pin_hash, territory)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, phone, territory, status, created_at`,
    [name, normalizeKEPhone(phone), pinHash, territory ?? null]
  );
  return rows[0];
}

/** Every coordinator with a rollup of their activators' performance, for the admin panel. */
export async function adminListCoordinators() {
  const { rows } = await query(
    `SELECT c.id, c.name, c.phone, c.territory, c.status, c.created_at,
            COALESCE(ce.activator_count, 0) AS activator_count,
            COALESCE(ce.paid_sessions, 0)   AS paid_sessions,
            COALESCE(ce.gross_kes, 0)       AS gross_kes,
            COALESCE(ce.commission_kes, 0)  AS commission_kes
     FROM coordinators c
     LEFT JOIN coordinator_earnings ce ON ce.id = c.id
     ORDER BY c.created_at DESC`
  );
  return rows;
}

const COORDINATOR_FIELD_COLUMNS = {
  name: "name",
  territory: "territory",
  status: "status",
};

/**
 * Partial update — only fields present in `fields` are touched. `pin`, if
 * given, is hashed and applied alongside any other fields in the same
 * statement. Returns null if the id doesn't exist.
 */
export async function updateCoordinator(id, fields) {
  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(COORDINATOR_FIELD_COLUMNS)) {
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
    const { rows } = await query(`SELECT * FROM coordinators WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  values.push(id);
  const { rows } = await query(
    `UPDATE coordinators SET ${sets.join(", ")} WHERE id = $${values.length}
     RETURNING id, name, phone, territory, status`,
    values
  );
  return rows[0] || null;
}
