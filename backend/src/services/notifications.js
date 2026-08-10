import { query } from "../db/pool.js";
import { sendSms } from "./sms.js";

// notifications.type -> the matching key in activators.notification_prefs
// (and the frontend's `notifs` state object — same 4 keys, see
// ActivatorDashboardScreen.svelte).
const PREF_KEY_BY_TYPE = {
  expiring: "expiring",
  dormant: "dormant",
  goal_miss: "goalMiss",
  new_purchase: "newPurchase",
};

/**
 * Creates an in-app notification for an activator, and — for genuinely new
 * ones only — sends it as SMS too (see services/sms.js; simulated until a
 * real provider is configured). No-ops entirely if the activator has that
 * notification type turned off.
 *
 * `dedupeKey`, if given, makes this idempotent per (activator, type, key) —
 * the periodic sweep (services/notificationSweep.js) calls this every tick
 * for every currently-matching row, and relies on the unique index in
 * schema.sql to turn repeat calls for the same underlying event (e.g. "session
 * X expiring") into a no-op instead of spamming a fresh notification each
 * tick. Event-driven calls (new_purchase) don't need one — each call is
 * already a genuinely new event.
 *
 * Never throws — a notification failure must never break whatever
 * triggered it (a payment authorising, the sweep running).
 */
export async function notify(activatorId, type, { title, body = null, dedupeKey = null }) {
  try {
    const { rows: activatorRows } = await query(
      `SELECT phone, notification_prefs FROM activators WHERE id = $1`,
      [activatorId]
    );
    const activator = activatorRows[0];
    if (!activator) return;

    const prefKey = PREF_KEY_BY_TYPE[type];
    if (prefKey && activator.notification_prefs?.[prefKey] === false) return;

    const { rows } = await query(
      `INSERT INTO notifications (activator_id, type, title, body, dedupe_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (activator_id, type, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [activatorId, type, title, body, dedupeKey]
    );

    // rows.length === 0 means this exact (activator, type, dedupeKey) was
    // already notified before (or dedupeKey is null and something else
    // raced this insert, vanishingly unlikely) — either way, don't re-send
    // the SMS for something the activator's already been told about.
    if (rows.length > 0 && activator.phone) {
      await sendSms(activator.phone, `${title}${body ? ` — ${body}` : ""}`);
    }
  } catch (err) {
    console.error(`⚠️ notify(${activatorId}, ${type}) failed:`, err.message);
  }
}

/** Most recent notifications for an activator, newest first. */
export async function listNotifications(activatorId, { limit = 30 } = {}) {
  const { rows } = await query(
    `SELECT id, type, title, body, read_at, created_at
     FROM notifications WHERE activator_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [activatorId, limit]
  );
  return rows;
}

export async function getUnreadCount(activatorId) {
  const { rows } = await query(
    `SELECT COUNT(*) AS total FROM notifications WHERE activator_id = $1 AND read_at IS NULL`,
    [activatorId]
  );
  return Number(rows[0].total);
}

export async function markAllRead(activatorId) {
  await query(
    `UPDATE notifications SET read_at = now() WHERE activator_id = $1 AND read_at IS NULL`,
    [activatorId]
  );
}

/**
 * Deletes notifications that are BOTH read AND older than `retentionDays`
 * (age measured from created_at, not from when they were read — a
 * notification "is a month old", not "was read a month ago") —
 * admin-configurable, see services/settings.js's notification_retention_days
 * / the admin dashboard's Settings tab. Unread notifications are never
 * touched here regardless of age. `retentionDays <= 0` means "keep
 * forever" (no-op), so the sweep can call this unconditionally without its
 * own branch.
 */
export async function deleteOldReadNotifications(retentionDays) {
  if (!(retentionDays > 0)) return 0;
  const { rowCount } = await query(
    `DELETE FROM notifications WHERE read_at IS NOT NULL AND created_at < now() - ($1 || ' days')::interval`,
    [retentionDays]
  );
  return rowCount;
}
