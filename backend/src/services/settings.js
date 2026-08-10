import { query } from "../db/pool.js";

const DEFAULTS = {
  earn_connect_threshold_secs: 1800,
  default_activator_commission_rate: 0.2,
  // How long a READ notification is kept before the sweep (see
  // services/notificationSweep.js) deletes it. Unread notifications are
  // never auto-deleted regardless of age — only read ones "go stale". 0 =
  // keep forever (no cleanup).
  notification_retention_days: 30,
};

async function getRawSetting(key) {
  const { rows } = await query(`SELECT value FROM app_settings WHERE key = $1`, [key]);
  return rows[0]?.value ?? null;
}

/** Public settings the frontend needs before login — currently just the Earn Free Access connect threshold. */
export async function getPublicSettings() {
  const raw = await getRawSetting("earn_connect_threshold_secs");
  const earnConnectThresholdSecs = raw !== null ? Number(raw) : DEFAULTS.earn_connect_threshold_secs;
  return { earnConnectThresholdSecs };
}

/**
 * Admin-only settings — everything getPublicSettings() has, plus internal
 * business config (commission rate) that clients never need to see.
 */
export async function adminGetSettings() {
  const [publicSettings, rawCommission, rawRetention] = await Promise.all([
    getPublicSettings(),
    getRawSetting("default_activator_commission_rate"),
    getRawSetting("notification_retention_days"),
  ]);
  const defaultActivatorCommissionRate =
    rawCommission !== null ? Number(rawCommission) : DEFAULTS.default_activator_commission_rate;
  const notificationRetentionDays =
    rawRetention !== null ? Number(rawRetention) : DEFAULTS.notification_retention_days;
  return { ...publicSettings, defaultActivatorCommissionRate, notificationRetentionDays };
}

/** How many days a read notification is kept before the sweep deletes it. Also used directly by services/notificationSweep.js — not routed through adminGetSettings() there to avoid a public-settings round-trip on every sweep tick. */
export async function getNotificationRetentionDays() {
  const raw = await getRawSetting("notification_retention_days");
  return raw !== null ? Number(raw) : DEFAULTS.notification_retention_days;
}

/** Update the Earn Free Access "Connect Now" threshold (seconds). */
export async function setEarnConnectThresholdSecs(secs) {
  await query(
    `INSERT INTO app_settings (key, value) VALUES ('earn_connect_threshold_secs', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(Math.max(0, Math.round(secs)))]
  );
  return adminGetSettings();
}

/**
 * Update the default commission rate (0–1) new activators are created with.
 * Existing activators are untouched — this only changes what the admin
 * panel's "create activator" form pre-fills; each activator's own rate
 * still overrides it individually.
 */
export async function setDefaultActivatorCommissionRate(rate) {
  const clamped = Math.min(1, Math.max(0, rate));
  await query(
    `INSERT INTO app_settings (key, value) VALUES ('default_activator_commission_rate', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(clamped)]
  );
  return adminGetSettings();
}

/** Update how many days a read notification is kept before cleanup (0 = keep forever). */
export async function setNotificationRetentionDays(days) {
  await query(
    `INSERT INTO app_settings (key, value) VALUES ('notification_retention_days', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(Math.max(0, Math.round(days)))]
  );
  return adminGetSettings();
}
