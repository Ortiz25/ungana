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

/** Looks up a client by MAC — used to auto-fill a previously-set username at checkout. */
export async function getClientByMac(macAddress) {
  const { rows } = await query(`SELECT id, username FROM clients WHERE mac_address = $1`, [macAddress.toLowerCase()]);
  return rows[0] || null;
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
