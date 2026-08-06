import { query } from "../db/pool.js";
import { adminGetContentItem } from "./content.js";

/**
 * Everything the admin dashboard's Analytics tab shows, split into "earned"
 * (Watch & Earn engagement) and "purchased" (real money) — one aggregator
 * so the route stays a thin pass-through. All counts are computed live off
 * `content_items`/`content_completions`/`sessions`; nothing is cached.
 */
export async function getAdminAnalytics() {
  const [
    impressionsResult,
    completionsResult,
    engagedClientsResult,
    earnedSecsResult,
    earnedSessionsResult,
    contentOverviewResult,
    purchasedResult,
    activeNowResult,
    byPackageResult,
    byProviderResult,
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
    query(`SELECT COUNT(*) AS total FROM sessions WHERE payment_status = 'success' AND expires_at > now()`),
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
  ]);

  return {
    earned: {
      totalImpressions: Number(impressionsResult.rows[0].total),
      totalCompletions: Number(completionsResult.rows[0].total),
      uniqueClientsEngaged: Number(engagedClientsResult.rows[0].total),
      totalEarnedSecs: Number(earnedSecsResult.rows[0].total),
      totalClaimedSecs: Number(earnedSecsResult.rows[0].claimed),
      sessionsGrantedViaEarning: Number(earnedSessionsResult.rows[0].total),
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
