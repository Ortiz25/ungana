import { query } from "../db/pool.js";
import { upsertClient, getClientByMac } from "./clients.js";
import { getCurrentPeriodKey } from "../utils/periodKey.js";

/** Public catalogue for the Watch & Earn screen — active items only. */
export async function listActiveContent() {
  const { rows } = await query(
    `SELECT id, type, section, view_frequency, title, category, duration_label, earn_secs, min_watch_secs, img_url, body_url, survey_questions
     FROM content_items
     WHERE is_active = true
     ORDER BY sort_order, id`
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
 * exists. Includes `earn_secs` so the frontend can rebuild an accurate
 * unclaimed balance (sum where claimed = false) after a reload.
 */
export async function getClientCompletions(macAddress) {
  const client = await getClientByMac(macAddress);
  if (!client) return [];

  const items = await listActiveContent();
  const results = [];

  for (const item of items) {
    const periodKey = await getCurrentPeriodKey(item.view_frequency, client.id);
    const { rows } = await query(
      `SELECT claimed, earn_secs FROM content_completions
       WHERE client_id = $1 AND content_item_id = $2 AND period_key = $3`,
      [client.id, item.id, periodKey]
    );
    if (rows[0]) results.push({ content_item_id: item.id, claimed: rows[0].claimed, earn_secs: rows[0].earn_secs });
  }

  return results;
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
 * Atomically marks every currently-unclaimed completion for this client as
 * claimed and returns their ids + summed earn_secs. The UPDATE's row-level
 * locking means two concurrent claim requests can't both grab the same
 * completions — the second call simply finds nothing left unclaimed. See
 * routes/content.js POST /claim-earned-session, the only caller.
 */
export async function claimUnclaimedCompletions(clientId) {
  const { rows } = await query(
    `UPDATE content_completions SET claimed = true WHERE client_id = $1 AND claimed = false RETURNING id, earn_secs`,
    [clientId]
  );
  return { ids: rows.map((r) => r.id), totalSecs: rows.reduce((sum, r) => sum + r.earn_secs, 0) };
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

export async function adminListAllContent() {
  const { rows } = await query(`SELECT * FROM content_items ORDER BY sort_order, id`);
  return rows;
}

export async function adminGetContentItem(id) {
  const { rows } = await query(`SELECT * FROM content_items WHERE id = $1`, [id]);
  return rows[0] || null;
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
}) {
  const { rows } = await query(
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
  return rows[0];
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

/** Partial update — only fields present in `fields` are touched. Returns null if the id doesn't exist. */
export async function updateContentItem(id, fields) {
  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(CONTENT_FIELD_COLUMNS)) {
    if (fields[key] === undefined) continue;
    const value = key === "surveyQuestions" && fields[key] !== null ? JSON.stringify(fields[key]) : fields[key];
    sets.push(`${column} = $${sets.length + 1}`);
    values.push(value);
  }

  if (sets.length === 0) return adminGetContentItem(id);

  values.push(id);
  const { rows } = await query(`UPDATE content_items SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
  return rows[0] || null;
}

/** Soft "delete" — deactivates rather than removing the row, since content_completions references it (audit history must survive). */
export async function deactivateContentItem(id) {
  const { rows } = await query(`UPDATE content_items SET is_active = false WHERE id = $1 RETURNING *`, [id]);
  return rows[0] || null;
}
