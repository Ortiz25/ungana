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
    `SELECT p.id, p.label, p.price_kes, p.duration_secs, p.badge, p.is_featured
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
// Packages started as a small, fixed seeded set of plan types (daily/
// weekly/monthly/...) but admins can now add their own alongside them —
// `id` is a free-text slug (see schema.sql's packages.id comment), not a
// constrained enum, so a new row here needs nothing else changed in the
// DB. The frontend purchase screen (PackageScreen.svelte) falls back to a
// generic icon/duration label for any id it doesn't have static UI
// metadata for, so a freshly created package is purchasable immediately.

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

/** Creates a new plan type. `id` is admin-chosen (a slug like "hourly") and must be unique — callers should catch the pg unique-violation (error.code "23505"), same convention as createSite. `badge` (e.g. "Best Value", "Test") is optional, null = none. */
export async function createPackage({ id, label, priceKes, durationSecs, badge = null, isActive = true, siteIds = [] }) {
  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO packages (id, label, price_kes, duration_secs, badge, is_active) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, label, priceKes, durationSecs, badge, isActive]
    );
    if (siteIds.length > 0) await setPackageSites(client, id, siteIds);

    const { rows } = await client.query(`SELECT p.*, ${PACKAGE_SITE_IDS_SUBQUERY} FROM packages p WHERE p.id = $1`, [id]);
    return rows[0];
  });
}

/** Hard delete. Blocked by the DB (FK violation, error.code "23503") if any session references this package — sessions.package_id has no ON DELETE action, so purchase history can't silently vanish; callers should catch that and tell the admin to deactivate it instead. */
export async function deletePackage(id) {
  const { rows } = await query(`DELETE FROM packages WHERE id = $1 RETURNING *`, [id]);
  return rows[0] || null;
}

const PACKAGE_FIELD_COLUMNS = {
  label: "label",
  priceKes: "price_kes",
  durationSecs: "duration_secs",
  badge: "badge",
  isActive: "is_active",
};

/**
 * Sets (or clears) which package is pre-highlighted on the purchase screen.
 * Deliberately not part of PACKAGE_FIELD_COLUMNS/updatePackage — at most
 * one row can be featured (see the partial unique index in schema.sql), so
 * turning one on has to atomically turn the previous one off first, which a
 * plain per-field partial update can't express safely.
 */
export async function setPackageFeatured(id, featured) {
  return withTransaction(async (client) => {
    if (featured) {
      await client.query(`UPDATE packages SET is_featured = false WHERE is_featured = true AND id != $1`, [id]);
    }
    const { rows } = await client.query(`UPDATE packages SET is_featured = $2 WHERE id = $1 RETURNING id`, [id, featured]);
    if (rows.length === 0) return null;

    const { rows: full } = await client.query(`SELECT p.*, ${PACKAGE_SITE_IDS_SUBQUERY} FROM packages p WHERE p.id = $1`, [id]);
    return full[0];
  });
}

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
