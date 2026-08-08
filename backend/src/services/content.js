import { query, withTransaction } from "../db/pool.js";
import { upsertClient, getClientByMac } from "./clients.js";
import { getCurrentPeriodKey } from "../utils/periodKey.js";

/**
 * Public catalogue for the Watch & Earn screen — active items only.
 * `siteId` scopes it to one UniFi site via content_item_sites — an item
 * with no rows there is visible on every site (the default for existing
 * content and for anyone not yet using multi-site). Passing siteId as
 * null/undefined skips site filtering entirely rather than showing only
 * "global" items — that's deliberate: local dev has no captive-portal URL
 * to read a site from, so it should see everything, not an artificially
 * narrowed catalogue.
 */
export async function listActiveContent(siteId = null) {
  const { rows } = await query(
    `SELECT ci.id, ci.type, ci.section, ci.view_frequency, ci.title, ci.category, ci.duration_label,
            ci.earn_secs, ci.min_watch_secs, ci.img_url, ci.body_url, ci.survey_questions
     FROM content_items ci
     WHERE ci.is_active = true
       AND (
         $1::text IS NULL
         OR NOT EXISTS (SELECT 1 FROM content_item_sites cis WHERE cis.content_item_id = ci.id)
         OR EXISTS (SELECT 1 FROM content_item_sites cis WHERE cis.content_item_id = ci.id AND cis.site_id = $1)
       )
     ORDER BY ci.sort_order, ci.id`,
    [siteId]
  );
  return rows;
}

export async function getContentItemById(id) {
  const { rows } = await query(`SELECT * FROM content_items WHERE id = $1 AND is_active = true`, [id]);
  return rows[0] || null;
}

/** Increments the view counter for an item — fired when a client opens it in the viewer, not on completion. */
export async function recordImpression(contentItemId) {
  await query(`UPDATE content_items SET impressions = impressions + 1 WHERE id = $1`, [contentItemId]);
}

/**
 * Which items this device currently can't (re-)start — for UI restore after
 * reload. Per-item "locked" is computed against *this item's own current
 * period* (see getCurrentPeriodKey) — a daily item completed yesterday is
 * NOT locked today, even though a completion row for yesterday still
 * exists. For a `session`-scoped item, the period key is the client's most
 * recent session id, so it rolls to a new value the moment ANY session is
 * created — that's what makes the item re-completable next session, but it
 * also means a completion earned *before* that new session exists under the
 * old ("no-session-yet") period key now, and would silently drop out of
 * this per-current-period list even though it's still sitting unclaimed.
 * `unclaimedSecs` is queried separately, across every period, so the
 * client's real banked balance survives that rollover and reload correctly
 * — see the regression this fixed: unclaimed minutes appeared to vanish
 * the moment a new session was created.
 */
export async function getClientCompletions(macAddress, siteId = null) {
  const client = await getClientByMac(macAddress);
  if (!client) return { completions: [], unclaimedSecs: 0 };

  const items = await listActiveContent(siteId);
  const completions = [];

  for (const item of items) {
    const periodKey = await getCurrentPeriodKey(item.view_frequency, client.id);
    const { rows } = await query(
      `SELECT claimed, earn_secs FROM content_completions
       WHERE client_id = $1 AND content_item_id = $2 AND period_key = $3`,
      [client.id, item.id, periodKey]
    );
    if (rows[0]) completions.push({ content_item_id: item.id, claimed: rows[0].claimed, earn_secs: rows[0].earn_secs });
  }

  const { rows: unclaimedRows } = await query(
    `SELECT COALESCE(SUM(earn_secs), 0) AS total FROM content_completions WHERE client_id = $1 AND claimed = false`,
    [client.id]
  );

  return { completions, unclaimedSecs: Number(unclaimedRows[0].total) };
}

/**
 * Server-authoritative completion recording — the only thing that actually
 * credits a reward. Rejects video/article/lesson completions that don't
 * report enough real elapsed time, and survey completions with no answers,
 * rather than trusting the client's own progress bar (see TimelineScreen's
 * old client-only `completedIds` Set, which this replaces).
 *
 * Returns { ok: false, reason } on rejection, or
 * { ok: true, alreadyCompleted, earnSecs } — `earnSecs` is 0 when the item
 * was already completed earlier *in its current period* (no
 * double-crediting within the same day/week/month/session — see
 * content_completions' (client_id, content_item_id, period_key) uniqueness).
 */
export async function recordCompletion(macAddress, contentItemId, { elapsedSecs = 0, response = null } = {}) {
  const item = await getContentItemById(contentItemId);
  if (!item) return { ok: false, reason: "not_found" };

  if (item.type === "survey") {
    const answered = Array.isArray(response) ? response.length > 0 : !!response && Object.keys(response).length > 0;
    if (!answered) return { ok: false, reason: "response_required" };
  } else if (elapsedSecs < item.min_watch_secs) {
    return { ok: false, reason: "insufficient_watch_time" };
  }

  const clientId = await upsertClient(macAddress);
  const periodKey = await getCurrentPeriodKey(item.view_frequency, clientId);

  const { rows } = await query(
    `INSERT INTO content_completions (client_id, content_item_id, earn_secs, response, period_key)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (client_id, content_item_id, period_key) DO NOTHING
     RETURNING earn_secs`,
    [clientId, contentItemId, item.earn_secs, response ? JSON.stringify(response) : null, periodKey]
  );

  if (rows.length === 0) return { ok: true, alreadyCompleted: true, earnSecs: 0 };
  return { ok: true, alreadyCompleted: false, earnSecs: rows[0].earn_secs };
}

/**
 * Marks unclaimed completions for this client as claimed and returns their
 * ids + summed earn_secs — either all of them (requestedSecs omitted, the
 * original "Connect Now" behaviour), or, when requestedSecs is given, just
 * enough of the oldest ones to reach it, leaving the rest banked for next
 * time. A single completion's earn_secs is never split — it's an atomic
 * unit (one video/article/survey, snapshotted at completion time) — so the
 * actual total returned can come in slightly *above* requestedSecs; it is
 * never below it (unless the client's whole balance is smaller).
 *
 * Wrapped in a transaction with FOR UPDATE row locks so two concurrent
 * claims can't select the same completions — the original single
 * UPDATE...RETURNING was atomic by construction; splitting into
 * SELECT-then-UPDATE to support partial claims needs that locking to keep
 * the same guarantee. See routes/content.js POST /claim-earned-session,
 * the only caller.
 */
export async function claimUnclaimedCompletions(clientId, requestedSecs = null) {
  return withTransaction(async (client) => {
    const { rows: candidates } = await client.query(
      `SELECT id, earn_secs FROM content_completions
       WHERE client_id = $1 AND claimed = false
       ORDER BY completed_at ASC
       FOR UPDATE`,
      [clientId]
    );

    let selected = candidates;
    if (requestedSecs != null) {
      selected = [];
      let sum = 0;
      for (const row of candidates) {
        if (sum >= requestedSecs) break;
        selected.push(row);
        sum += row.earn_secs;
      }
    }

    if (selected.length === 0) return { ids: [], totalSecs: 0 };

    const ids = selected.map((r) => r.id);
    await client.query(`UPDATE content_completions SET claimed = true WHERE id = ANY($1::bigint[])`, [ids]);
    return { ids, totalSecs: selected.reduce((sum, r) => sum + r.earn_secs, 0) };
  });
}

/** Links already-claimed completions to the session their reward was folded into, for audit purposes. */
export async function attachClaimedSession(completionIds, sessionId) {
  if (completionIds.length === 0) return;
  await query(`UPDATE content_completions SET claimed_session_id = $1 WHERE id = ANY($2::bigint[])`, [
    sessionId,
    completionIds,
  ]);
}

// ── Admin CRUD ───────────────────────────────────────────────────────────
// Unlike listActiveContent(), these ignore is_active — the admin panel needs
// to see (and re-activate) deactivated items too.

// site_ids: [] means global (visible everywhere) — matches
// content_item_sites' "no rows = everywhere" convention exactly, so the
// admin UI can treat an empty array and "no restriction" as the same thing.
const SITE_IDS_SUBQUERY = `
  COALESCE(
    (SELECT array_agg(cis.site_id ORDER BY cis.site_id) FROM content_item_sites cis WHERE cis.content_item_id = ci.id),
    ARRAY[]::text[]
  ) AS site_ids
`;

export async function adminListAllContent() {
  const { rows } = await query(`SELECT ci.*, ${SITE_IDS_SUBQUERY} FROM content_items ci ORDER BY ci.sort_order, ci.id`);
  return rows;
}

export async function adminGetContentItem(id) {
  const { rows } = await query(`SELECT ci.*, ${SITE_IDS_SUBQUERY} FROM content_items ci WHERE ci.id = $1`, [id]);
  return rows[0] || null;
}

/** Replaces this item's site assignment wholesale — simplest correct semantics for a "visible on" multi-select that saves as one unit. */
async function setContentItemSites(client, contentItemId, siteIds) {
  await client.query(`DELETE FROM content_item_sites WHERE content_item_id = $1`, [contentItemId]);
  if (siteIds && siteIds.length > 0) {
    const values = siteIds.map((_, i) => `($1, $${i + 2})`).join(", ");
    await client.query(`INSERT INTO content_item_sites (content_item_id, site_id) VALUES ${values}`, [contentItemId, ...siteIds]);
  }
}

export async function createContentItem({
  type,
  section = "whats_new",
  viewFrequency = "once",
  title,
  category,
  durationLabel,
  earnSecs,
  minWatchSecs = 0,
  imgUrl,
  bodyUrl,
  surveyQuestions,
  sortOrder = 0,
  siteIds, // undefined/[] = visible on every site
}) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO content_items
         (type, section, view_frequency, title, category, duration_label, earn_secs, min_watch_secs, img_url, body_url, survey_questions, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        type,
        section,
        viewFrequency,
        title,
        category ?? null,
        durationLabel ?? null,
        earnSecs,
        minWatchSecs,
        imgUrl ?? null,
        bodyUrl ?? null,
        surveyQuestions ? JSON.stringify(surveyQuestions) : null,
        sortOrder,
      ]
    );
    if (siteIds && siteIds.length > 0) await setContentItemSites(client, rows[0].id, siteIds);
    return { ...rows[0], site_ids: siteIds ?? [] };
  });
}

// Maps request-body keys to their column — whitelisted so PATCH can build a
// dynamic, partial UPDATE without ever interpolating a caller-controlled
// column name into SQL.
const CONTENT_FIELD_COLUMNS = {
  type: "type",
  section: "section",
  viewFrequency: "view_frequency",
  title: "title",
  category: "category",
  durationLabel: "duration_label",
  earnSecs: "earn_secs",
  minWatchSecs: "min_watch_secs",
  imgUrl: "img_url",
  bodyUrl: "body_url",
  surveyQuestions: "survey_questions",
  sortOrder: "sort_order",
  isActive: "is_active",
};

/**
 * Partial update — only fields present in `fields` are touched. Returns
 * null if the id doesn't exist. `siteIds`, if present (even as `[]`, which
 * means "make it global"), replaces the item's site assignment wholesale —
 * it's handled separately from CONTENT_FIELD_COLUMNS since it's a join
 * table, not a column on content_items.
 */
export async function updateContentItem(id, fields) {
  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(CONTENT_FIELD_COLUMNS)) {
    if (fields[key] === undefined) continue;
    const value = key === "surveyQuestions" && fields[key] !== null ? JSON.stringify(fields[key]) : fields[key];
    sets.push(`${column} = $${sets.length + 1}`);
    values.push(value);
  }

  if (sets.length === 0 && fields.siteIds === undefined) return adminGetContentItem(id);

  return withTransaction(async (client) => {
    if (sets.length > 0) {
      values.push(id);
      const { rows } = await client.query(`UPDATE content_items SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING id`, values);
      if (rows.length === 0) return null;
    }
    if (fields.siteIds !== undefined) await setContentItemSites(client, id, fields.siteIds);

    const { rows } = await client.query(`SELECT ci.*, ${SITE_IDS_SUBQUERY} FROM content_items ci WHERE ci.id = $1`, [id]);
    return rows[0] || null;
  });
}

/** Soft "delete" — deactivates rather than removing the row, since content_completions references it (audit history must survive). */
export async function deactivateContentItem(id) {
  const { rows } = await query(`UPDATE content_items SET is_active = false WHERE id = $1 RETURNING *`, [id]);
  return rows[0] || null;
}
