import { query } from "../db/pool.js";

/**
 * Public feed for an institution site's Notice Board / Campus Events / Exam
 * Timetable / Resources / Polls — active posts only, optionally narrowed to
 * one `type`. Pinned posts always float to the top; within that, events and
 * timetable entries (both genuinely time-based) sort soonest-first
 * (event_starts_at) and everything else sorts newest-first (published_at) —
 * matches how a notice board, an events calendar, and an exam schedule are
 * each naturally read.
 *
 * Each 'poll' row additionally carries a computed `poll_results` array
 * (`[{optionIndex, votes}]`, only for options that actually have at least
 * one vote), same as services/communityPosts.js's listActivePosts — tallies
 * are always derived live from campus_poll_votes, never cached on the row.
 */
export async function listActivePosts(siteId, type = null) {
  const { rows } = await query(
    `SELECT p.*,
       CASE WHEN p.type = 'poll' THEN (
         SELECT COALESCE(json_agg(json_build_object('optionIndex', v.option_index, 'votes', v.cnt) ORDER BY v.option_index), '[]'::json)
         FROM (
           SELECT option_index, COUNT(*) AS cnt
           FROM campus_poll_votes
           WHERE post_id = p.id
           GROUP BY option_index
         ) v
       ) END AS poll_results
     FROM campus_posts p
     WHERE p.site_id = $1 AND p.is_active = true
       AND ($2::text IS NULL OR p.type = $2)
     ORDER BY p.is_pinned DESC,
       CASE WHEN p.type IN ('event', 'timetable') THEN p.event_starts_at END ASC NULLS LAST,
       p.published_at DESC`,
    [siteId, type]
  );
  return rows;
}

// ── Admin CRUD ───────────────────────────────────────────────────────────
// Unlike listActivePosts(), these ignore is_active — the admin panel needs
// to see (and re-activate) deactivated posts too.

/** Every post for a site (admin panel), or every post across every site if siteId is omitted. */
export async function adminListPosts(siteId = null) {
  const { rows } = await query(
    `SELECT * FROM campus_posts WHERE $1::text IS NULL OR site_id = $1 ORDER BY sort_order, id DESC`,
    [siteId]
  );
  return rows;
}

export async function adminGetPost(id) {
  const { rows } = await query(`SELECT * FROM campus_posts WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function createCampusPost({
  siteId,
  type,
  title,
  body,
  category,
  priority = "normal",
  attachmentUrl,
  eventStartsAt,
  eventEndsAt,
  location,
  metadata = {},
  isPinned = false,
  sortOrder = 0,
  images = [],
}) {
  const { rows } = await query(
    `INSERT INTO campus_posts
       (site_id, type, title, body, category, priority, attachment_url, event_starts_at, event_ends_at, location, metadata, is_pinned, sort_order, images)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      siteId,
      type,
      title,
      body ?? null,
      category ?? null,
      priority,
      attachmentUrl ?? null,
      eventStartsAt ?? null,
      eventEndsAt ?? null,
      location ?? null,
      JSON.stringify(metadata ?? {}),
      isPinned,
      sortOrder,
      JSON.stringify(images ?? []),
    ]
  );
  return rows[0];
}

// Maps request-body keys to their column — whitelisted so PATCH can build a
// dynamic, partial UPDATE without ever interpolating a caller-controlled
// column name into SQL. Same pattern as content.js's CONTENT_FIELD_COLUMNS.
const CAMPUS_POST_FIELD_COLUMNS = {
  type: "type",
  title: "title",
  body: "body",
  category: "category",
  priority: "priority",
  attachmentUrl: "attachment_url",
  eventStartsAt: "event_starts_at",
  eventEndsAt: "event_ends_at",
  location: "location",
  metadata: "metadata",
  isPinned: "is_pinned",
  sortOrder: "sort_order",
  isActive: "is_active",
  images: "images",
};

const JSON_FIELDS = new Set(["images", "metadata"]);

/** Partial update — only fields present in `fields` are touched. Returns null if the id doesn't exist. */
export async function updateCampusPost(id, fields) {
  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(CAMPUS_POST_FIELD_COLUMNS)) {
    if (fields[key] === undefined) continue;
    sets.push(`${column} = $${sets.length + 1}`);
    values.push(JSON_FIELDS.has(key) ? JSON.stringify(fields[key] ?? (key === "images" ? [] : {})) : fields[key]);
  }

  if (sets.length === 0) return adminGetPost(id);

  values.push(id);
  const { rows } = await query(`UPDATE campus_posts SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
  return rows[0] || null;
}

/** Soft "delete" — deactivates rather than removing the row, consistent with deactivateContentItem. */
export async function deactivateCampusPost(id) {
  const { rows } = await query(`UPDATE campus_posts SET is_active = false WHERE id = $1 RETURNING *`, [id]);
  return rows[0] || null;
}

/** Increments a resource (Quick Links) tile's tap counter — same pattern as content.js's recordImpression. */
export async function recordCampusPostClick(id) {
  await query(`UPDATE campus_posts SET clicks = clicks + 1 WHERE id = $1`, [id]);
}

/**
 * Casts one device's vote on a campus poll — same shape/reasoning as
 * services/communityPosts.js's castPollVote: locked in once cast via the
 * UNIQUE (post_id, mac) constraint, always returns the fresh per-option
 * tallies whether this call just voted or the device had already voted.
 */
export async function castPollVote(postId, mac, optionIndex) {
  await query(
    `INSERT INTO campus_poll_votes (post_id, mac, option_index) VALUES ($1, $2, $3)
     ON CONFLICT (post_id, mac) DO NOTHING`,
    [postId, mac.toLowerCase(), optionIndex]
  );

  const { rows } = await query(
    `SELECT option_index, COUNT(*)::int AS votes FROM campus_poll_votes WHERE post_id = $1 GROUP BY option_index ORDER BY option_index`,
    [postId]
  );
  return rows.map((r) => ({ optionIndex: r.option_index, votes: r.votes }));
}
