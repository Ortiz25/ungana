import { query } from "../db/pool.js";

/**
 * Public feed for a community site's Board / Events / Marketplace /
 * Services / Polls — active posts only, optionally narrowed to one `type`.
 * Pinned posts always float to the top; events sort soonest-first
 * (event_starts_at), everything else newest-first (published_at) — same
 * ordering rules as campusPosts.js's listActivePosts.
 *
 * Each 'poll' row additionally carries a computed `poll_results` array
 * (`[{optionIndex, votes}]`, only for options that actually have at least
 * one vote — the caller merges this against metadata.options to fill in
 * zero-vote options). Tallies are always derived live from
 * community_poll_votes here, never cached on the row itself, so there's no
 * way for a stored count to drift from the real votes.
 */
export async function listActivePosts(siteId, type = null) {
  const { rows } = await query(
    `SELECT p.*,
       CASE WHEN p.type = 'poll' THEN (
         SELECT COALESCE(json_agg(json_build_object('optionIndex', v.option_index, 'votes', v.cnt) ORDER BY v.option_index), '[]'::json)
         FROM (
           SELECT option_index, COUNT(*) AS cnt
           FROM community_poll_votes
           WHERE post_id = p.id
           GROUP BY option_index
         ) v
       ) END AS poll_results
     FROM community_posts p
     WHERE p.site_id = $1 AND p.is_active = true
       AND ($2::text IS NULL OR p.type = $2)
     ORDER BY p.is_pinned DESC,
       CASE WHEN p.type = 'event' THEN p.event_starts_at END ASC NULLS LAST,
       p.published_at DESC`,
    [siteId, type]
  );
  return rows;
}

// ── Admin CRUD ───────────────────────────────────────────────────────────
// Unlike listActivePosts(), these ignore is_active — the admin panel needs
// to see (and re-activate) deactivated posts too. Same shape as
// campusPosts.js's admin functions.

/** Every post for a site (admin panel), or every post across every site if siteId is omitted. */
export async function adminListPosts(siteId = null) {
  const { rows } = await query(
    `SELECT * FROM community_posts WHERE $1::text IS NULL OR site_id = $1 ORDER BY sort_order, id DESC`,
    [siteId]
  );
  return rows;
}

export async function adminGetPost(id) {
  const { rows } = await query(`SELECT * FROM community_posts WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function createCommunityPost({
  siteId,
  type,
  title,
  body,
  category,
  priority = "normal",
  attachmentUrl,
  priceKes,
  eventStartsAt,
  eventEndsAt,
  location,
  metadata = {},
  isPinned = false,
  sortOrder = 0,
  images = [],
}) {
  const { rows } = await query(
    `INSERT INTO community_posts
       (site_id, type, title, body, category, priority, attachment_url, price_kes, event_starts_at, event_ends_at, location, metadata, is_pinned, sort_order, images)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      siteId,
      type,
      title,
      body ?? null,
      category ?? null,
      priority,
      attachmentUrl ?? null,
      priceKes ?? null,
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
// column name into SQL. Same pattern as campusPosts.js's
// CAMPUS_POST_FIELD_COLUMNS / content.js's CONTENT_FIELD_COLUMNS.
const COMMUNITY_POST_FIELD_COLUMNS = {
  type: "type",
  title: "title",
  body: "body",
  category: "category",
  priority: "priority",
  attachmentUrl: "attachment_url",
  priceKes: "price_kes",
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
export async function updateCommunityPost(id, fields) {
  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(COMMUNITY_POST_FIELD_COLUMNS)) {
    if (fields[key] === undefined) continue;
    sets.push(`${column} = $${sets.length + 1}`);
    values.push(JSON_FIELDS.has(key) ? JSON.stringify(fields[key] ?? (key === "images" ? [] : {})) : fields[key]);
  }

  if (sets.length === 0) return adminGetPost(id);

  values.push(id);
  const { rows } = await query(`UPDATE community_posts SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
  return rows[0] || null;
}

/** Soft "delete" — deactivates rather than removing the row, consistent with deactivateCampusPost. */
export async function deactivateCommunityPost(id) {
  const { rows } = await query(`UPDATE community_posts SET is_active = false WHERE id = $1 RETURNING *`, [id]);
  return rows[0] || null;
}

/** Increments a listing/service tile's tap counter — same pattern as campusPosts.js's recordCampusPostClick. */
export async function recordCommunityPostClick(id) {
  await query(`UPDATE community_posts SET clicks = clicks + 1 WHERE id = $1`, [id]);
}

/**
 * Casts one device's vote on a poll. A vote is locked in once cast — the
 * UNIQUE (post_id, mac) constraint makes a repeat call a no-op rather than
 * changing the existing vote, so a retried/duplicate request can never
 * double-count or flip someone else's submitted answer. Returns the fresh
 * per-option tallies either way (whether this call just voted or the device
 * had already voted earlier), so the caller can always render live results.
 */
export async function castPollVote(postId, mac, optionIndex) {
  await query(
    `INSERT INTO community_poll_votes (post_id, mac, option_index) VALUES ($1, $2, $3)
     ON CONFLICT (post_id, mac) DO NOTHING`,
    [postId, mac.toLowerCase(), optionIndex]
  );

  const { rows } = await query(
    `SELECT option_index, COUNT(*)::int AS votes FROM community_poll_votes WHERE post_id = $1 GROUP BY option_index ORDER BY option_index`,
    [postId]
  );
  return rows.map((r) => ({ optionIndex: r.option_index, votes: r.votes }));
}

/** Whether this device has already voted on this poll — lets the caller distinguish "cast a fresh vote" from "already voted, here are the results". */
export async function hasVoted(postId, mac) {
  const { rows } = await query(`SELECT 1 FROM community_poll_votes WHERE post_id = $1 AND mac = $2`, [postId, mac.toLowerCase()]);
  return rows.length > 0;
}
