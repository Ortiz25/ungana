import { query } from "../db/pool.js";

function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Computes the current "period" a content completion falls into, given a
 * content item's view_frequency. Two completions with the same client +
 * item + period key collide (content_completions' unique constraint) —
 * different keys are what actually let an item become re-completable.
 */
export async function getCurrentPeriodKey(viewFrequency, clientId) {
  const now = new Date();

  switch (viewFrequency) {
    case "daily":
      return now.toISOString().slice(0, 10); // '2026-08-06'
    case "weekly":
      return isoWeekKey(now); // '2026-W32'
    case "monthly":
      return now.toISOString().slice(0, 7); // '2026-08'
    case "session": {
      const { rows } = await query(`SELECT id FROM sessions WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1`, [
        clientId,
      ]);
      // No session yet — everyone gets one shot under this sentinel until
      // their first real session exists, at which point that session's id
      // becomes the period key and unlocks it again.
      return rows[0]?.id ?? "no-session-yet";
    }
    default:
      return "once";
  }
}
