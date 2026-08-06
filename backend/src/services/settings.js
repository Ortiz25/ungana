import { query } from "../db/pool.js";

const DEFAULTS = {
  earn_connect_threshold_secs: 1800,
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

/** Same as getPublicSettings() — separate name for the admin panel's own read, in case they diverge later. */
export async function adminGetSettings() {
  return getPublicSettings();
}

/** Update the Earn Free Access "Connect Now" threshold (seconds). */
export async function setEarnConnectThresholdSecs(secs) {
  await query(
    `INSERT INTO app_settings (key, value) VALUES ('earn_connect_threshold_secs', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(Math.max(0, Math.round(secs)))]
  );
  return getPublicSettings();
}
