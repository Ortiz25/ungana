import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";

export async function findActivatorByCode(code) {
  const { rows } = await query(`SELECT * FROM activators WHERE code = $1 AND status = 'active'`, [code]);
  return rows[0] || null;
}

export async function findActivatorByPhone(phone) {
  const { rows } = await query(`SELECT * FROM activators WHERE phone = $1 AND status = 'active'`, [phone]);
  return rows[0] || null;
}

/** Verify a login PIN against the stored hash. Returns the activator row or null. */
export async function verifyActivatorLogin(phone, pin) {
  const activator = await findActivatorByPhone(phone);
  if (!activator) return null;
  const ok = await bcrypt.compare(pin, activator.pin_hash);
  return ok ? activator : null;
}

/** Create an activator with a hashed PIN (admin/onboarding use). */
export async function createActivator({ code, name, phone, pin, territory, mpesaNumber, commissionRate = 0.2 }) {
  const pinHash = await bcrypt.hash(pin, 10);
  const { rows } = await query(
    `INSERT INTO activators (code, name, phone, pin_hash, territory, mpesa_number, commission_rate)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, code, name, phone, territory, mpesa_number, commission_rate, status, created_at`,
    [code, name, phone, pinHash, territory, mpesaNumber, commissionRate]
  );
  return rows[0];
}

/** Earnings summary for one activator (backed by the activator_earnings view). */
export async function getActivatorEarnings(activatorId) {
  const { rows } = await query(`SELECT * FROM activator_earnings WHERE id = $1`, [activatorId]);
  return rows[0] || null;
}
