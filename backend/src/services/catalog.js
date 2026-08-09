import { query, withTransaction } from "../db/pool.js";

/**
 * Public plan catalogue — everything a package-selection screen needs.
 * `siteId` scopes it via package_sites the same way listActiveContent()
 * does — no rows for a package = sold everywhere (today's behaviour,
 * unchanged), and siteId itself being null/undefined skips site filtering
 * entirely (local dev has no captive-portal URL to read a site from, so it
 * should see every package, not an artificially narrowed catalogue).
 */
export async function listActivePackages(siteId = null) {
  const { rows } = await query(
    `SELECT p.id, p.label, p.price_kes, p.duration_secs
     FROM packages p
     WHERE p.is_active = true
       AND (
         $1::text IS NULL
         OR NOT EXISTS (SELECT 1 FROM package_sites ps WHERE ps.package_id = p.id)
         OR EXISTS (SELECT 1 FROM package_sites ps WHERE ps.package_id = p.id AND ps.site_id = $1)
       )
     ORDER BY p.price_kes ASC`,
    [siteId]
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

// ── Admin ────────────────────────────────────────────────────────────────
// Minimal on purpose — packages are a small, fixed set of plan types (no
// admin "create a package" flow exists, or is needed yet); this only adds
// what multi-site scoping requires: seeing every package (including
// inactive) with its site assignment, and editing price/label/active/sites.

const PACKAGE_SITE_IDS_SUBQUERY = `
  COALESCE(
    (SELECT array_agg(ps.site_id ORDER BY ps.site_id) FROM package_sites ps WHERE ps.package_id = p.id),
    ARRAY[]::text[]
  ) AS site_ids
`;

/**
 * Excludes 'earned' — it's not a real package, just a durable packages.id
 * row that sessions.package_id can point to for watch-to-earn grants (see
 * schema.sql's comment on it). It's permanently is_active = false so the
 * public catalogue never lists it either; showing it here would just let an
 * admin toggle it "active" or assign it to sites with no effect other than
 * confusion, since nothing ever checks its price/duration/site assignment.
 */
export async function adminListPackages() {
  const { rows } = await query(
    `SELECT p.*, ${PACKAGE_SITE_IDS_SUBQUERY} FROM packages p WHERE p.id != 'earned' ORDER BY p.price_kes ASC`
  );
  return rows;
}

async function setPackageSites(client, packageId, siteIds) {
  await client.query(`DELETE FROM package_sites WHERE package_id = $1`, [packageId]);
  if (siteIds && siteIds.length > 0) {
    const values = siteIds.map((_, i) => `($1, $${i + 2})`).join(", ");
    await client.query(`INSERT INTO package_sites (package_id, site_id) VALUES ${values}`, [packageId, ...siteIds]);
  }
}

const PACKAGE_FIELD_COLUMNS = {
  label: "label",
  priceKes: "price_kes",
  durationSecs: "duration_secs",
  isActive: "is_active",
};

/** Partial update — only fields present in `fields` are touched. `siteIds` (even `[]`) replaces the site assignment wholesale, same convention as content items. */
export async function updatePackage(id, fields) {
  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(PACKAGE_FIELD_COLUMNS)) {
    if (fields[key] === undefined) continue;
    sets.push(`${column} = $${sets.length + 1}`);
    values.push(fields[key]);
  }

  if (sets.length === 0 && fields.siteIds === undefined) {
    const { rows } = await query(`SELECT p.*, ${PACKAGE_SITE_IDS_SUBQUERY} FROM packages p WHERE p.id = $1`, [id]);
    return rows[0] || null;
  }

  return withTransaction(async (client) => {
    if (sets.length > 0) {
      values.push(id);
      const { rows } = await client.query(`UPDATE packages SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING id`, values);
      if (rows.length === 0) return null;
    }
    if (fields.siteIds !== undefined) await setPackageSites(client, id, fields.siteIds);

    const { rows } = await client.query(`SELECT p.*, ${PACKAGE_SITE_IDS_SUBQUERY} FROM packages p WHERE p.id = $1`, [id]);
    return rows[0] || null;
  });
}
