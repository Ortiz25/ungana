import { query } from "../db/pool.js";

/** Public plan catalogue — everything a package-selection screen needs. */
export async function listActivePackages() {
  const { rows } = await query(
    `SELECT id, label, price_kes, duration_secs FROM packages WHERE is_active = true ORDER BY price_kes ASC`
  );
  return rows;
}

/** Single package lookup — the source of truth for real (non-simulated) session duration. */
export async function getPackageById(id) {
  const { rows } = await query(`SELECT id, label, price_kes, duration_secs FROM packages WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Public-safe activator list for the referral picker. Deliberately excludes
 * phone, pin_hash, and mpesa_number — this endpoint is unauthenticated and
 * shown to any user choosing who referred them.
 */
export async function listActiveActivators() {
  const { rows } = await query(
    `SELECT code, name, territory FROM activators WHERE status = 'active' ORDER BY name ASC`
  );
  return rows;
}
