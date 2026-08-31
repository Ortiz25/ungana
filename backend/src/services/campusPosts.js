import { query } from "../db/pool.js";

/**
 * Public feed for an institution site's Notice Board / Campus Events / Exam
 * Timetable / Resources — active posts only, optionally narrowed to one
 * `type`. Pinned posts always float to the top; within that, events and
 * timetable entries (both genuinely time-based) sort soonest-first
 * (event_starts_at) and everything else sorts newest-first (published_at) —
 * matches how a notice board, an events calendar, and an exam schedule are
 * each naturally read.
 */
export async function listActivePosts(siteId, type = null) {
  const { rows } = await query(
    `SELECT * FROM campus_posts
     WHERE site_id = $1 AND is_active = true
       AND ($2::text IS NULL OR type = $2)
     ORDER BY is_pinned DESC,
       CASE WHEN type IN ('event', 'timetable') THEN event_starts_at END ASC NULLS LAST,
       published_at DESC`,
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
  isPinned = false,
  sortOrder = 0,
  images = [],
}) {
  const { rows } = await query(
    `INSERT INTO campus_posts
       (site_id, type, title, body, category, priority, attachment_url, event_starts_at, event_ends_at, location, is_pinned, sort_order, images)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
  isPinned: "is_pinned",
  sortOrder: "sort_order",
  isActive: "is_active",
  images: "images",
};

/** Partial update — only fields present in `fields` are touched. Returns null if the id doesn't exist. */
export async function updateCampusPost(id, fields) {
  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(CAMPUS_POST_FIELD_COLUMNS)) {
    if (fields[key] === undefined) continue;
    sets.push(`${column} = $${sets.length + 1}`);
    values.push(key === "images" ? JSON.stringify(fields[key] ?? []) : fields[key]);
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
