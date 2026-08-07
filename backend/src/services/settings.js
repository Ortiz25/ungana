import { query } from "../db/pool.js";

const DEFAULTS = {
  earn_connect_threshold_secs: 1800,
  default_activator_commission_rate: 0.2,
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
  const [publicSettings, rawCommission] = await Promise.all([
    getPublicSettings(),
    getRawSetting("default_activator_commission_rate"),
  ]);
  const defaultActivatorCommissionRate =
    rawCommission !== null ? Number(rawCommission) : DEFAULTS.default_activator_commission_rate;
  return { ...publicSettings, defaultActivatorCommissionRate };
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
