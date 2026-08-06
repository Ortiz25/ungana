import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";

export async function findAdminByUsername(username) {
  const { rows } = await query(`SELECT * FROM admin_users WHERE username = $1`, [username]);
  return rows[0] || null;
}

/** Verify an admin login. Returns the admin row (with password_hash) or null. */
export async function verifyAdminLogin(username, password) {
  const admin = await findAdminByUsername(username);
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.password_hash);
  return ok ? admin : null;
}
