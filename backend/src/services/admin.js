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

// ── Admin account management (super_admin only — see routes/admin.js) ─────
// Every function here deliberately excludes password_hash from what it
// returns, same convention as activators.js/coordinators.js never exposing
// pin_hash to their own admin-list endpoints.

const ADMIN_SAFE_COLUMNS = "id, username, role, created_at";

export async function adminListAdminUsers() {
  const { rows } = await query(`SELECT ${ADMIN_SAFE_COLUMNS} FROM admin_users ORDER BY created_at ASC`);
  return rows;
}

export async function getAdminUserById(id) {
  const { rows } = await query(`SELECT ${ADMIN_SAFE_COLUMNS} FROM admin_users WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** How many super_admin accounts currently exist — used to block an action that would leave zero. */
export async function countSuperAdmins() {
  const { rows } = await query(`SELECT COUNT(*)::int AS count FROM admin_users WHERE role = 'super_admin'`);
  return rows[0].count;
}

/** `role` defaults to plain 'admin' — a caller has to explicitly opt into creating another super_admin. Throws pg's unique-violation (error.code "23505") on a taken username, same convention as createSite/createPackage. */
export async function createAdminUser({ username, password, role = "admin" }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO admin_users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING ${ADMIN_SAFE_COLUMNS}`,
    [username, passwordHash, role]
  );
  return rows[0];
}

/** Partial update — `role` and/or `password` (re-hashed here if present); either alone is fine. */
export async function updateAdminUser(id, { role, password } = {}) {
  const sets = [];
  const values = [];

  if (role !== undefined) {
    sets.push(`role = $${sets.length + 1}`);
    values.push(role);
  }
  if (password) {
    sets.push(`password_hash = $${sets.length + 1}`);
    values.push(await bcrypt.hash(password, 10));
  }

  if (sets.length === 0) return getAdminUserById(id);

  values.push(id);
  const { rows } = await query(`UPDATE admin_users SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING ${ADMIN_SAFE_COLUMNS}`, values);
  return rows[0] || null;
}

export async function deleteAdminUser(id) {
  const { rows } = await query(`DELETE FROM admin_users WHERE id = $1 RETURNING ${ADMIN_SAFE_COLUMNS}`, [id]);
  return rows[0] || null;
}
