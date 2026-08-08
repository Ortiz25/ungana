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

export async function createSite({ id, name, mode = "both" }) {
  const { rows } = await query(
    `INSERT INTO sites (id, name, mode) VALUES ($1, $2, $3) RETURNING *`,
    [id, name, mode]
  );
  return rows[0];
}

const SITE_FIELD_COLUMNS = {
  name: "name",
  mode: "mode",
  status: "status",
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
 * Real sites known to the UniFi controller, for the admin "Add Site" form
 * to pick from instead of typing an id by hand — the id it returns is
 * exactly what belongs in `sites.id` (see the schema comment on that
 * column for why it has to match the controller's own site id). Returns
 * null if the controller is unreachable or UNIFI_URL isn't configured;
 * the admin can still type an id manually in that case.
 */
export async function listUnifiSiteOptions() {
  return getUnifiSites();
}
