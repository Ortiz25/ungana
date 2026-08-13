import { query } from "../db/pool.js";

/** Every escalation for one coordinator, most recent first, with the reported activator's current name/territory if any. */
export async function listEscalationsForCoordinator(coordinatorId) {
  const { rows } = await query(
    `SELECT e.id, e.issue, e.priority, e.status, e.created_at, e.updated_at,
            a.id AS activator_id, a.name AS activator_name, a.territory AS activator_territory
     FROM escalations e
     LEFT JOIN activators a ON a.id = e.activator_id
     WHERE e.coordinator_id = $1
     ORDER BY e.created_at DESC`,
    [coordinatorId]
  );
  return rows;
}

/**
 * Raise a new escalation for this coordinator. `activatorId`, if given, must
 * actually report to this coordinator — returns null (not created) if it
 * doesn't, same "don't let a coordinator touch another team's data" rule as
 * the activator-history endpoint.
 */
export async function createEscalation(coordinatorId, { issue, priority = "medium", activatorId }) {
  if (activatorId != null) {
    const owns = await query(`SELECT 1 FROM activators WHERE id = $1 AND coordinator_id = $2`, [
      activatorId,
      coordinatorId,
    ]);
    if (owns.rows.length === 0) return null;
  }

  const { rows } = await query(
    `INSERT INTO escalations (coordinator_id, activator_id, issue, priority)
     VALUES ($1, $2, $3, $4)
     RETURNING id, issue, priority, status, created_at, updated_at`,
    [coordinatorId, activatorId ?? null, issue, priority]
  );
  return rows[0];
}

/** Update an escalation's status — only if it belongs to this coordinator. Returns null if not found/not owned. */
export async function updateEscalationStatus(coordinatorId, id, status) {
  const { rows } = await query(
    `UPDATE escalations SET status = $1 WHERE id = $2 AND coordinator_id = $3
     RETURNING id, issue, priority, status, created_at, updated_at`,
    [status, id, coordinatorId]
  );
  return rows[0] || null;
}
