// Periodic checks for the 3 notification types that aren't tied to a
// single event (new_purchase fires inline instead — see
// services/authorization.js). Wired into server.js's existing
// setInterval-based sweep pattern (see the retry sweep next to it).
import { query } from "../db/pool.js";
import { notify } from "./notifications.js";

/** Sessions with an activator, currently active, expiring within the next 24h. */
async function sweepExpiring() {
  const { rows } = await query(
    `SELECT id, activator_id, client_mac, expires_at
     FROM sessions
     WHERE activator_id IS NOT NULL AND payment_status = 'success'
       AND expires_at BETWEEN now() AND now() + INTERVAL '24 hours'`
  );

  for (const s of rows) {
    await notify(s.activator_id, "expiring", {
      title: "A referred client's session is expiring soon",
      body: `${s.client_mac} expires within 24 hours`,
      dedupeKey: `session:${s.id}`,
    });
  }
}

/** Clients locked to an activator who haven't been seen in 7+ days. */
async function sweepDormant() {
  const { rows } = await query(
    `SELECT id, activator_id, mac_address, last_seen
     FROM clients
     WHERE activator_id IS NOT NULL AND last_seen < now() - INTERVAL '7 days'`
  );

  for (const c of rows) {
    // No date in the dedupe key — this is a one-time nudge per client, not
    // a recurring one. A client who comes back and later goes dormant
    // again won't be re-notified; re-arming that is future scope, not
    // needed for a first cut of this feature.
    await notify(c.activator_id, "dormant", {
      title: "A referred client has gone quiet",
      body: `${c.mac_address} hasn't been seen in 7+ days`,
      dedupeKey: `client:${c.id}`,
    });
  }
}

// Only worth checking once an activator's day is mostly spent — checking
// at 9am against a full day's target would flag everyone as "behind" for
// no reason. 18:00 local server time is a reasonable "most of the day is
// over" cutoff without needing a real pace curve.
const GOAL_MISS_CHECK_HOUR = 18;

/** Activators whose today's commission is under their daily target, checked once it's late enough in the day to mean anything. */
async function sweepGoalMiss() {
  if (new Date().getHours() < GOAL_MISS_CHECK_HOUR) return;

  const today = new Date().toISOString().slice(0, 10);
  const { rows } = await query(
    `SELECT a.id, a.daily_target_kes, COALESCE(SUM(s.commission_kes), 0) AS earned_today
     FROM activators a
     LEFT JOIN sessions s
       ON s.activator_id = a.id AND s.payment_status = 'success' AND s.authorized_at >= CURRENT_DATE
     WHERE a.status = 'active'
     GROUP BY a.id, a.daily_target_kes
     HAVING COALESCE(SUM(s.commission_kes), 0) < a.daily_target_kes`
  );

  for (const a of rows) {
    await notify(a.id, "goal_miss", {
      title: "Behind on today's goal",
      body: `KES ${Number(a.earned_today).toLocaleString()} of your KES ${Number(a.daily_target_kes).toLocaleString()} daily target so far`,
      dedupeKey: `daily:${today}`,
    });
  }
}

export async function runNotificationSweep() {
  await sweepExpiring();
  await sweepDormant();
  await sweepGoalMiss();
}
