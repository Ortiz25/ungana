import { query } from "../db/pool.js";
import { adminGetContentItem } from "./content.js";

/**
 * Everything the admin dashboard's Analytics tab shows, split into "earned"
 * (Watch & Earn engagement) and "purchased" (real money) — one aggregator
 * so the route stays a thin pass-through. All counts are computed live off
 * `content_items`/`content_completions`/`sessions`; nothing is cached.
 */

/**
 * Formats a Postgres `date`-typed column's JS Date back to 'YYYY-MM-DD'.
 * node-postgres parses `date` values as local midnight of that calendar
 * date — NOT UTC midnight — so `.toISOString()` (which always converts to
 * UTC first) silently rolls the date back a day whenever the machine's
 * local timezone is ahead of UTC (e.g. Africa/Nairobi, UTC+3: local
 * midnight Aug 9 is 21:00 UTC on Aug 8). Reading the LOCAL getters instead
 * recovers exactly the calendar date Postgres sent, regardless of offset.
 */
function formatDbDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SITE_TIMELINE_DAYS = 14;

/**
 * Daily purchase revenue for the last SITE_TIMELINE_DAYS days, one series
 * per site (zero-filled, via CROSS JOIN so a quiet day still gets a point
 * instead of a gap), plus one extra series for sessions with no site_id —
 * pre-multi-site history and local-dev sessions, which never carry a real
 * site. Left as a real series (not dropped) so the admin can see that
 * volume rather than have it silently vanish from the total; the frontend
 * can choose to hide it if it's all zero.
 */
async function getPurchasesBySiteTimeline() {
  const [perSiteResult, unassignedResult] = await Promise.all([
    query(
      `WITH days AS (
         SELECT generate_series(CURRENT_DATE - INTERVAL '${SITE_TIMELINE_DAYS - 1} days', CURRENT_DATE, INTERVAL '1 day')::date AS day
       )
       SELECT s.id AS site_id, s.name AS site_name, d.day,
              COALESCE(SUM(se.amount_kes) FILTER (WHERE se.id IS NOT NULL), 0) AS revenue
       FROM sites s
       CROSS JOIN days d
       LEFT JOIN sessions se
         ON se.site_id = s.id AND se.source = 'purchase' AND se.payment_status = 'success'
         AND date_trunc('day', se.authorized_at) = d.day
       GROUP BY s.id, s.name, d.day
       ORDER BY s.id, d.day`
    ),
    query(
      `WITH days AS (
         SELECT generate_series(CURRENT_DATE - INTERVAL '${SITE_TIMELINE_DAYS - 1} days', CURRENT_DATE, INTERVAL '1 day')::date AS day
       )
       SELECT d.day,
              COALESCE(SUM(se.amount_kes) FILTER (WHERE se.id IS NOT NULL), 0) AS revenue
       FROM days d
       LEFT JOIN sessions se
         ON se.site_id IS NULL AND se.source = 'purchase' AND se.payment_status = 'success'
         AND date_trunc('day', se.authorized_at) = d.day
       GROUP BY d.day
       ORDER BY d.day`
    ),
  ]);

  const days = unassignedResult.rows.map((r) => formatDbDate(r.day));

  const bySite = new Map();
  for (const row of perSiteResult.rows) {
    if (!bySite.has(row.site_id)) bySite.set(row.site_id, { siteId: row.site_id, siteName: row.site_name, data: [] });
    bySite.get(row.site_id).data.push(Number(row.revenue));
  }
  const series = [...bySite.values()];

  const unassignedData = unassignedResult.rows.map((r) => Number(r.revenue));
  if (unassignedData.some((v) => v > 0)) {
    series.push({ siteId: null, siteName: "No site (unassigned)", data: unassignedData });
  }

  return { days, series };
}

// Bucket unit -> how many buckets back to show and the matching interval
// literal. Whitelisted (not built from caller input directly) since the
// unit gets interpolated into date_trunc()/interval literals, which can't
// be parameterized with a placeholder in Postgres.
const GRANULARITY_CONFIG = {
  day: { unit: "day", count: 30 },
  week: { unit: "week", count: 12 },
  month: { unit: "month", count: 12 },
};

/**
 * The "View more" detail behind the dashboard's compact 14-day chart —
 * same per-site zero-filled shape, but with a caller-chosen bucket size
 * (day/week/month) and an optional single-site filter, for the admin
 * Analytics tab's drill-down view. `granularity` must be a key of
 * GRANULARITY_CONFIG (validated by the route before this is called);
 * `siteId` narrows to one site's series when given, otherwise every site
 * (plus "no site", if it has any revenue in-window) is returned.
 */
export async function getPurchasesBySiteSeries({ granularity = "day", siteId = null } = {}) {
  const config = GRANULARITY_CONFIG[granularity] ?? GRANULARITY_CONFIG.day;
  const { unit, count } = config;
  // Cast to plain `date` right in the bucket list — date_trunc(..., now())
  // truncates in the session's local timezone (Africa/Nairobi, UTC+3) but
  // stays a timestamptz, so serializing it straight to JS/ISO shifts it
  // back a day once node-postgres converts to UTC. `date` has no time/zone
  // component, so it round-trips exactly — same reasoning as the working
  // 14-day chart's CURRENT_DATE. The join below casts se.authorized_at's
  // truncation the same way so the comparison still lines up.
  const bucketsCte = `
    WITH buckets AS (
      SELECT generate_series(
        date_trunc('${unit}', now()) - INTERVAL '${count - 1} ${unit}',
        date_trunc('${unit}', now()),
        INTERVAL '1 ${unit}'
      )::date AS bucket
    )
  `;

  // Bucket list queried on its own, independent of siteId/sessions, so the
  // period labels are always the full requested window even when the
  // site/data joins below come back empty (e.g. a site with zero purchases,
  // or — belt and braces — a siteId that doesn't exist).
  const [bucketsResult, perSiteResult, unassignedResult] = await Promise.all([
    query(`${bucketsCte} SELECT bucket FROM buckets ORDER BY bucket`),
    query(
      `${bucketsCte}
       SELECT s.id AS site_id, s.name AS site_name, b.bucket,
              COALESCE(SUM(se.amount_kes) FILTER (WHERE se.id IS NOT NULL), 0) AS revenue,
              COUNT(se.id) FILTER (WHERE se.id IS NOT NULL) AS count
       FROM sites s
       CROSS JOIN buckets b
       LEFT JOIN sessions se
         ON se.site_id = s.id AND se.source = 'purchase' AND se.payment_status = 'success'
         AND date_trunc('${unit}', se.authorized_at)::date = b.bucket
       WHERE ($1::text IS NULL OR s.id = $1)
       GROUP BY s.id, s.name, b.bucket
       ORDER BY s.id, b.bucket`,
      [siteId]
    ),
    query(
      `${bucketsCte}
       SELECT b.bucket,
              COALESCE(SUM(se.amount_kes) FILTER (WHERE se.id IS NOT NULL), 0) AS revenue,
              COUNT(se.id) FILTER (WHERE se.id IS NOT NULL) AS count
       FROM buckets b
       LEFT JOIN sessions se
         ON se.site_id IS NULL AND se.source = 'purchase' AND se.payment_status = 'success'
         AND date_trunc('${unit}', se.authorized_at)::date = b.bucket
       WHERE $1::text IS NULL
       GROUP BY b.bucket
       ORDER BY b.bucket`,
      [siteId]
    ),
  ]);

  const periods = bucketsResult.rows.map((r) => formatDbDate(r.bucket));

  const bySite = new Map();
  for (const row of perSiteResult.rows) {
    if (!bySite.has(row.site_id)) {
      bySite.set(row.site_id, { siteId: row.site_id, siteName: row.site_name, data: [], counts: [] });
    }
    const s = bySite.get(row.site_id);
    s.data.push(Number(row.revenue));
    s.counts.push(Number(row.count));
  }
  const series = [...bySite.values()];

  if (!siteId) {
    const unassignedData = unassignedResult.rows.map((r) => Number(r.revenue));
    const unassignedCounts = unassignedResult.rows.map((r) => Number(r.count));
    if (unassignedData.some((v) => v > 0)) {
      series.push({ siteId: null, siteName: "No site (unassigned)", data: unassignedData, counts: unassignedCounts });
    }
  }

  return { granularity, periods, series };
}

export async function getAdminAnalytics() {
  const [
    impressionsResult,
    completionsResult,
    engagedClientsResult,
    earnedSecsResult,
    earnedSessionsResult,
    earnedActiveNowResult,
    contentOverviewResult,
    purchasedResult,
    activeNowResult,
    byPackageResult,
    byProviderResult,
    bySiteTimeline,
  ] = await Promise.all([
    query(`SELECT COALESCE(SUM(impressions), 0) AS total FROM content_items`),
    query(`SELECT COUNT(*) AS total FROM content_completions`),
    query(`SELECT COUNT(DISTINCT client_id) AS total FROM content_completions`),
    query(
      `SELECT COALESCE(SUM(earn_secs), 0) AS total,
              COALESCE(SUM(earn_secs) FILTER (WHERE claimed), 0) AS claimed
       FROM content_completions`
    ),
    query(`SELECT COUNT(*) AS total FROM sessions WHERE source = 'earned' AND payment_status = 'success'`),
    query(`SELECT COUNT(*) AS total FROM sessions WHERE source = 'earned' AND payment_status = 'success' AND expires_at > now()`),
    // Every content item, not just top performers — the admin panel's
    // "overview for all contents" table, one row per item with a link into
    // getContentItemAnalytics() for the survey-answer-level drill-down.
    query(
      `SELECT ci.id, ci.title, ci.type, ci.is_active, ci.impressions, COUNT(cc.id) AS completions
       FROM content_items ci
       LEFT JOIN content_completions cc ON cc.content_item_id = ci.id
       GROUP BY ci.id, ci.title, ci.type, ci.is_active, ci.impressions
       ORDER BY completions DESC, ci.impressions DESC`
    ),
    query(
      `SELECT COUNT(*) AS sessions, COALESCE(SUM(amount_kes), 0) AS revenue, COALESCE(SUM(commission_kes), 0) AS commission
       FROM sessions WHERE source = 'purchase' AND payment_status = 'success'`
    ),
    // Scoped to source = 'purchase' — previously this counted every active
    // session regardless of source, silently folding Watch & Earn grants
    // into a stat card labelled "Purchases". Earned gets its own count now
    // (earnedActiveNowResult above) instead of being invisibly merged in.
    query(`SELECT COUNT(*) AS total FROM sessions WHERE source = 'purchase' AND payment_status = 'success' AND expires_at > now()`),
    query(
      `SELECT package_id, COUNT(*) AS count, COALESCE(SUM(amount_kes), 0) AS revenue
       FROM sessions WHERE source = 'purchase' AND payment_status = 'success'
       GROUP BY package_id ORDER BY revenue DESC`
    ),
    query(
      `SELECT payment_provider, COUNT(*) AS count, COALESCE(SUM(amount_kes), 0) AS revenue
       FROM sessions
       WHERE source = 'purchase' AND payment_status = 'success' AND payment_provider IS NOT NULL
       GROUP BY payment_provider ORDER BY revenue DESC`
    ),
    getPurchasesBySiteTimeline(),
  ]);

  return {
    earned: {
      totalImpressions: Number(impressionsResult.rows[0].total),
      totalCompletions: Number(completionsResult.rows[0].total),
      uniqueClientsEngaged: Number(engagedClientsResult.rows[0].total),
      totalEarnedSecs: Number(earnedSecsResult.rows[0].total),
      totalClaimedSecs: Number(earnedSecsResult.rows[0].claimed),
      sessionsGrantedViaEarning: Number(earnedSessionsResult.rows[0].total),
      activeSessionsNow: Number(earnedActiveNowResult.rows[0].total),
      contentOverview: contentOverviewResult.rows.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        isActive: r.is_active,
        impressions: Number(r.impressions),
        completions: Number(r.completions),
      })),
    },
    purchased: {
      totalPaidSessions: Number(purchasedResult.rows[0].sessions),
      totalRevenueKes: Number(purchasedResult.rows[0].revenue),
      totalCommissionKes: Number(purchasedResult.rows[0].commission),
      activeSessionsNow: Number(activeNowResult.rows[0].total),
      byPackage: byPackageResult.rows.map((r) => ({
        packageId: r.package_id,
        count: Number(r.count),
        revenueKes: Number(r.revenue),
      })),
      byProvider: byProviderResult.rows.map((r) => ({
        provider: r.payment_provider,
        count: Number(r.count),
        revenueKes: Number(r.revenue),
      })),
      bySiteTimeline,
    },
  };
}

/**
 * Per-item drill-down for the Analytics tab's "view details" on a single
 * content item — impressions/completions/engagement, plus, for surveys,
 * a per-question answer breakdown built from every completion's stored
 * `response` (see TimelineScreen's answerSurveyQuestion — response is
 * `{questionIndex: answerText}`, one row per client per completion).
 * Returns null if the item doesn't exist.
 */
export async function getContentItemAnalytics(contentItemId) {
  const item = await adminGetContentItem(contentItemId);
  if (!item) return null;

  const completionsResult = await query(
    `SELECT COUNT(*) AS total, COUNT(DISTINCT client_id) AS unique_clients, COALESCE(SUM(earn_secs), 0) AS earn_secs
     FROM content_completions WHERE content_item_id = $1`,
    [contentItemId]
  );
  const stats = completionsResult.rows[0];

  let surveyBreakdown = null;
  if (item.type === "survey") {
    const { rows } = await query(
      `SELECT kv.key AS question_index, kv.value AS answer, COUNT(*) AS count
       FROM content_completions cc, jsonb_each_text(cc.response) AS kv
       WHERE cc.content_item_id = $1 AND cc.response IS NOT NULL
       GROUP BY kv.key, kv.value
       ORDER BY kv.key::int, count DESC`,
      [contentItemId]
    );
    surveyBreakdown = {};
    for (const row of rows) {
      if (!surveyBreakdown[row.question_index]) surveyBreakdown[row.question_index] = [];
      surveyBreakdown[row.question_index].push({ answer: row.answer, count: Number(row.count) });
    }
  }

  const impressions = Number(item.impressions);
  const completions = Number(stats.total);

  return {
    id: item.id,
    title: item.title,
    type: item.type,
    section: item.section,
    isActive: item.is_active,
    impressions,
    completions,
    uniqueClients: Number(stats.unique_clients),
    completionRate: impressions > 0 ? completions / impressions : null,
    totalEarnSecsAwarded: Number(stats.earn_secs),
    surveyQuestions: item.survey_questions ?? null,
    surveyBreakdown,
  };
}
