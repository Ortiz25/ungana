import { query } from "../db/pool.js";
import { getSites as getUnifiSites } from "./unifi.js";

/** Every site, for the admin panel — includes suspended ones (same soft-disable convention as activators/coordinators). */
export async function adminListSites() {
  const { rows } = await query(`SELECT * FROM sites ORDER BY created_at DESC`);
  return rows;
}

/** A single site — used both by admin and by the public mode-check endpoint. */
export async function getSite(id) {
  if (!id) return null;
  const { rows } = await query(`SELECT * FROM sites WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function createSite({ id, name, mode = "both", btcEnabled = true }) {
  const { rows } = await query(
    `INSERT INTO sites (id, name, mode, btc_enabled) VALUES ($1, $2, $3, $4) RETURNING *`,
    [id, name, mode, btcEnabled]
  );
  return rows[0];
}

const SITE_FIELD_COLUMNS = {
  name: "name",
  mode: "mode",
  status: "status",
  btcEnabled: "btc_enabled",
};

/** Partial update — only fields present in `fields` are touched. Returns null if the id doesn't exist. */
export async function updateSite(id, fields) {
  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(SITE_FIELD_COLUMNS)) {
    if (fields[key] === undefined) continue;
    sets.push(`${column} = $${sets.length + 1}`);
    values.push(fields[key]);
  }

  if (sets.length === 0) return getSite(id);

  values.push(id);
  const { rows } = await query(`UPDATE sites SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
  return rows[0] || null;
}

/**
 * Deletes a site outright (not a soft-disable like activators/coordinators
 * — sites carry no history worth preserving on their own). Sessions that
 * referenced it fall back to site_id = NULL (ON DELETE SET NULL) and any
 * content/package restrictions to just this site are dropped (ON DELETE
 * CASCADE), which reverts those items to "visible on every site" per the
 * join table's no-rows-means-global convention. Returns the deleted row,
 * or null if the id didn't exist.
 */
export async function deleteSite(id) {
  const { rows } = await query(`DELETE FROM sites WHERE id = $1 RETURNING *`, [id]);
  return rows[0] || null;
}

/**
 * Real sites known to the UniFi controller, for the admin "Add Site" form
 * to pick from instead of typing an id by hand. UniFi's own `name` field is
 * the short slug that actually shows up in captive-portal redirect URLs
 * (`/s/<name>/...`) — that's what belongs in `sites.id` (see the schema
 * comment on that column) — while `desc` is the human-readable label admins
 * set in the UniFi UI, which is what belongs in `sites.name`. Returns null
 * if the controller is unreachable or UNIFI_URL isn't configured; the admin
 * can still type an id manually in that case.
 */
export async function listUnifiSiteOptions() {
  const raw = await getUnifiSites();
  if (!raw) return raw;
  return raw.map((s) => ({ id: s.name, name: s.desc || s.name }));
}
