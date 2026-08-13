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

/**
 * Activators reporting to this coordinator, with their own performance — for
 * the coordinator's own "my team" view. `dormant_count` uses the exact same
 * 7-day-idle definition as the activator dashboard's dormant-client
 * notification sweep (see notificationSweep.js's sweepDormant) — same
 * meaning, just aggregated per activator instead of fired as individual
 * notifications.
 */
export async function getActivatorsForCoordinator(coordinatorId) {
  const { rows } = await query(
    `SELECT a.id, a.code, a.name, a.territory, a.status,
            COALESCE(ae.paid_sessions, 0)  AS paid_sessions,
            COALESCE(ae.gross_kes, 0)      AS gross_kes,
            COALESCE(ae.commission_kes, 0) AS commission_kes,
            COALESCE(dc.dormant_count, 0)  AS dormant_count
     FROM activators a
     LEFT JOIN activator_earnings ae ON ae.id = a.id
     LEFT JOIN (
       SELECT activator_id, COUNT(*) AS dormant_count
       FROM clients
       WHERE activator_id IS NOT NULL AND last_seen < now() - INTERVAL '7 days'
       GROUP BY activator_id
     ) dc ON dc.activator_id = a.id
     WHERE a.coordinator_id = $1
     ORDER BY a.name`,
    [coordinatorId]
  );
  return rows;
}

// trunc: the date_trunc() field name for this period's bucket size.
// step: one bucket's width, as an interval literal (text, cast in SQL).
// count: how many buckets back from the current one to include (so `week`
// with count 6 = the current day's bucket plus the 6 before it = 7 days
// total — same shape as the frontend's old 7-element weekly mock array).
const ACTIVATOR_HISTORY_PERIODS = {
  week: { trunc: "day", step: "1 day", count: 6 }, // trailing 7 days
  month: { trunc: "week", step: "1 week", count: 3 }, // trailing 4 weeks
  year: { trunc: "month", step: "1 month", count: 11 }, // trailing 12 months
};

/**
 * Real day/week/month bucketed earnings history for one activator, scoped to
 * a coordinator — powers the coordinator dashboard's drill-down charts with
 * actual `sessions` data instead of the old ACT_WEEKLY/MONTHLY/YEARLY
 * fixtures. Returns null if `activatorId` doesn't exist or doesn't report to
 * this coordinator (a coordinator has no business seeing another team's
 * numbers), or if `period` isn't recognised.
 */
export async function getActivatorHistoryForCoordinator(coordinatorId, activatorId, period) {
  const cfg = ACTIVATOR_HISTORY_PERIODS[period];
  if (!cfg) return null;

  const owns = await query(`SELECT 1 FROM activators WHERE id = $1 AND coordinator_id = $2`, [
    activatorId,
    coordinatorId,
  ]);
  if (owns.rows.length === 0) return null;

  const { rows } = await query(
    `WITH buckets AS (
       SELECT generate_series(
         date_trunc($2, now()) - ($3::interval * $4),
         date_trunc($2, now()),
         $3::interval
       ) AS bucket
     )
     SELECT b.bucket,
            COALESCE(COUNT(s.id) FILTER (WHERE s.payment_status = 'success'), 0)           AS paid_sessions,
            COALESCE(SUM(s.amount_kes) FILTER (WHERE s.payment_status = 'success'), 0)     AS gross_kes,
            COALESCE(SUM(s.commission_kes) FILTER (WHERE s.payment_status = 'success'), 0) AS commission_kes
     FROM buckets b
     LEFT JOIN sessions s
       ON s.activator_id = $1 AND date_trunc($2, s.created_at) = b.bucket
     GROUP BY b.bucket
     ORDER BY b.bucket`,
    [activatorId, cfg.trunc, cfg.step, cfg.count]
  );
  return rows;
}

/**
 * Per-territory rollup of this coordinator's activators — activator count,
 * dormant count, paid sessions, gross/commission, and open escalations.
 * Powers the Regions tab — same underlying data as
 * getActivatorsForCoordinator, just grouped by territory instead of listed
 * per activator. Escalation counts only include ones attributed to a
 * specific activator (a coordinator's own general-issue escalations have no
 * territory to be counted against).
 */
export async function getRegionsForCoordinator(coordinatorId) {
  const { rows } = await query(
    `WITH act_stats AS (
       SELECT a.id, COALESCE(NULLIF(a.territory, ''), 'Unassigned') AS territory,
              COALESCE(ae.paid_sessions, 0)  AS paid_sessions,
              COALESCE(ae.gross_kes, 0)      AS gross_kes,
              COALESCE(ae.commission_kes, 0) AS commission_kes,
              COALESCE(dc.dormant_count, 0)  AS dormant_count,
              COALESCE(esc.open_count, 0)    AS open_count
       FROM activators a
       LEFT JOIN activator_earnings ae ON ae.id = a.id
       LEFT JOIN (
         SELECT activator_id, COUNT(*) AS dormant_count
         FROM clients
         WHERE activator_id IS NOT NULL AND last_seen < now() - INTERVAL '7 days'
         GROUP BY activator_id
       ) dc ON dc.activator_id = a.id
       LEFT JOIN (
         SELECT activator_id, COUNT(*) AS open_count
         FROM escalations
         WHERE activator_id IS NOT NULL AND status != 'resolved'
         GROUP BY activator_id
       ) esc ON esc.activator_id = a.id
       WHERE a.coordinator_id = $1
     )
     SELECT territory,
            COUNT(*)            AS activator_count,
            SUM(paid_sessions)  AS paid_sessions,
            SUM(gross_kes)      AS gross_kes,
            SUM(commission_kes) AS commission_kes,
            SUM(dormant_count)  AS dormant_count,
            SUM(open_count)     AS open_escalations
     FROM act_stats
     GROUP BY territory
     ORDER BY territory`,
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
