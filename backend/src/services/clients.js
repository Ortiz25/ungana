import { query } from "../db/pool.js";

/**
 * Insert-or-touch a client by MAC address (the device identity); returns
 * the client id. `phone` is optional and, when given, overwrites the
 * client's last-used number — the same device may pay with different
 * M-Pesa numbers across sessions.
 */
export async function upsertClient(macAddress, phone = null) {
  const { rows } = await query(
    `INSERT INTO clients (mac_address, phone) VALUES ($1, $2)
     ON CONFLICT (mac_address) DO UPDATE
       SET last_seen = now(),
           phone = COALESCE(EXCLUDED.phone, clients.phone)
     RETURNING id`,
    [macAddress.toLowerCase(), phone]
  );
  return rows[0].id;
}

/**
 * Claim a username for a client. Throws a Postgres unique-violation
 * (error.code === "23505") if it's already taken by a different client —
 * callers should catch that specifically and surface "username taken"
 * rather than a generic 500.
 */
export async function setClientUsername(clientId, username) {
  await query(`UPDATE clients SET username = $1 WHERE id = $2`, [username, clientId]);
}

/** Looks up a client by MAC — used to auto-fill a previously-set username/activator at checkout. */
export async function getClientByMac(macAddress) {
  const { rows } = await query(
    `SELECT id, username, activator_id, activator_locked FROM clients WHERE mac_address = $1`,
    [macAddress.toLowerCase()]
  );
  return rows[0] || null;
}

/**
 * Permanently fix which activator (if any — null means self-onboarded) gets
 * commission on this client's purchases. Only takes effect once, on the
 * client's first purchase — a no-op on every call after that, by design, so
 * a returning client can never be re-attributed to redirect/dodge
 * commission (see the schema.sql comment on `clients.activator_locked`).
 */
export async function lockClientActivator(clientId, activatorId) {
  await query(`UPDATE clients SET activator_id = $2, activator_locked = true WHERE id = $1 AND activator_locked = false`, [
    clientId,
    activatorId,
  ]);
}

/**
 * Is `username` free to claim? True if unclaimed, or already claimed by
 * the same device (`macAddress`) — so a returning user re-checking their
 * own existing username during live validation isn't told it's "taken".
 */
export async function isUsernameAvailable(username, macAddress) {
  const { rows } = await query(`SELECT mac_address FROM clients WHERE username = $1`, [username]);
  if (rows.length === 0) return true;
  return !!macAddress && rows[0].mac_address === macAddress.toLowerCase();
}

/**
 * This client's locked activator assignment, for checkout auto-fill —
 * public-safe fields only (code/name/territory, never phone/mpesa_number).
 * `locked: false` means either a brand new MAC or one whose first purchase
 * hasn't happened yet, i.e. still free to choose. `locked: true` with
 * `activator: null` means permanently self-onboarded.
 */
export async function getClientAssignedActivator(macAddress) {
  const { rows } = await query(
    `SELECT c.activator_locked, a.code, a.name, a.territory
     FROM clients c
     LEFT JOIN activators a ON a.id = c.activator_id
     WHERE c.mac_address = $1`,
    [macAddress.toLowerCase()]
  );

  if (rows.length === 0) return { locked: false, activator: null };

  const row = rows[0];
  const activator = row.code ? { code: row.code, name: row.name, territory: row.territory } : null;
  return { locked: row.activator_locked, activator };
}
