import { Router } from "express";
import { verifyAdminLogin } from "../services/admin.js";
import { signAdminToken, requireAdmin } from "../middleware/auth.js";
import {
  adminListAllContent,
  createContentItem,
  updateContentItem,
  deactivateContentItem,
} from "../services/content.js";
import {
  adminListPosts,
  createCampusPost,
  updateCampusPost,
  deactivateCampusPost,
} from "../services/campusPosts.js";
import { createActivator, adminListActivators, updateActivator } from "../services/activators.js";
import { createCoordinator, adminListCoordinators, updateCoordinator } from "../services/coordinators.js";
import { uploadContentFile, optimizeUploadedVideo } from "../services/uploads.js";
import { adminGetSettings, setEarnConnectThresholdSecs, setDefaultActivatorCommissionRate, setNotificationRetentionDays } from "../services/settings.js";
import { getAdminAnalytics, getContentItemAnalytics, getPurchasesBySiteSeries, getPurchasesByPackageSeries } from "../services/analytics.js";
import { adminListSites, getSite, createSite, updateSite, deleteSite, listUnifiSiteOptions } from "../services/sites.js";
import { adminListPackages, updatePackage } from "../services/catalog.js";
import { testMinmoConnection } from "../services/payments/minmo.js";

export const adminRouter = Router();

/** POST /api/admin/login — Body: { username, password }. */
adminRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "username and password are required" });
  }

  const admin = await verifyAdminLogin(username, password);
  if (!admin) return res.status(401).json({ success: false, message: "Invalid username or password" });

  const token = signAdminToken(admin);
  res.json({ success: true, token, admin: { id: admin.id, username: admin.username } });
});

// Everything below requires a valid admin bearer token.
adminRouter.use(requireAdmin);

// ── Content ──────────────────────────────────────────────────────────────

/** GET /api/admin/content — every item, including deactivated ones. */
adminRouter.get("/content", async (_req, res) => {
  try {
    const items = await adminListAllContent();
    res.json({ items });
  } catch (error) {
    console.error("❌ Admin content list error:", error.message);
    res.status(500).json({ items: [], message: error.message });
  }
});

const CONTENT_SECTIONS = ["hero", "whats_new", "survey", "news", "watch_earn"];
const VIEW_FREQUENCIES = ["once", "daily", "weekly", "monthly", "session"];

/**
 * POST /api/admin/content
 * Body: { type, section?, viewFrequency?, title, category?, durationLabel?,
 *         earnSecs, minWatchSecs?, imgUrl?, bodyUrl?, surveyQuestions?, sortOrder? }
 * `section` picks which landing-feed zone this appears in — defaults to
 * 'whats_new' if omitted. `viewFrequency` picks how often a client can
 * re-earn this item's reward — defaults to 'once' (forever, per client) if
 * omitted; 'daily'/'weekly'/'monthly' reset on a calendar boundary,
 * 'session' resets whenever the client gets a new internet session.
 * `surveyQuestions` (array of { question, answers[] }) only matters for type='survey'.
 */
adminRouter.post("/content", async (req, res) => {
  const { type, title, earnSecs, section, viewFrequency } = req.body;
  if (!type || !title || earnSecs === undefined) {
    return res.status(400).json({ success: false, message: "type, title, and earnSecs are required" });
  }
  if (!["video", "article", "survey", "lesson"].includes(type)) {
    return res.status(400).json({ success: false, message: "type must be one of video, article, survey, lesson" });
  }
  if (section !== undefined && !CONTENT_SECTIONS.includes(section)) {
    return res.status(400).json({ success: false, message: `section must be one of ${CONTENT_SECTIONS.join(", ")}` });
  }
  if (viewFrequency !== undefined && !VIEW_FREQUENCIES.includes(viewFrequency)) {
    return res.status(400).json({ success: false, message: `viewFrequency must be one of ${VIEW_FREQUENCIES.join(", ")}` });
  }

  try {
    const item = await createContentItem(req.body);
    res.json({ success: true, item });
  } catch (error) {
    console.error("❌ Admin content create error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PATCH /api/admin/content/:id — partial update; any field from the create body, plus isActive. */
adminRouter.patch("/content/:id", async (req, res) => {
  if (req.body.section !== undefined && !CONTENT_SECTIONS.includes(req.body.section)) {
    return res.status(400).json({ success: false, message: `section must be one of ${CONTENT_SECTIONS.join(", ")}` });
  }
  if (req.body.viewFrequency !== undefined && !VIEW_FREQUENCIES.includes(req.body.viewFrequency)) {
    return res.status(400).json({ success: false, message: `viewFrequency must be one of ${VIEW_FREQUENCIES.join(", ")}` });
  }

  try {
    const item = await updateContentItem(req.params.id, req.body);
    if (!item) return res.status(404).json({ success: false, message: "Content item not found" });
    res.json({ success: true, item });
  } catch (error) {
    console.error("❌ Admin content update error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** DELETE /api/admin/content/:id — deactivates rather than hard-deletes (see services/content.js). */
adminRouter.delete("/content/:id", async (req, res) => {
  try {
    const item = await deactivateContentItem(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Content item not found" });
    res.json({ success: true, item });
  } catch (error) {
    console.error("❌ Admin content deactivate error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/content/upload — multipart, field name "file". Saves to
 * local disk (backend/uploads/) and returns { url: "/uploads/<name>" } — a
 * path relative to the backend's own origin, same convention as API_BASE in
 * the frontend's api.js, which resolves it to a full URL for dev vs. prod.
 * Images and short video clips only (see services/uploads.js for limits).
 * Video files are re-encoded (capped resolution/bitrate, +faststart) before
 * responding — see optimizeUploadedVideo — so this can take noticeably
 * longer than a plain file save for a multi-minute clip.
 */
adminRouter.post("/content/upload", (req, res) => {
  uploadContentFile(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    const filename = await optimizeUploadedVideo(req.file);
    res.json({ success: true, url: `/uploads/${filename}` });
  });
});

// ── Campus posts (notices, releases, events — institution sites) ─────────

/** GET /api/admin/campus-posts?site=<id> — every post, including deactivated ones; site is optional (omit to see every site's posts). */
adminRouter.get("/campus-posts", async (req, res) => {
  try {
    const posts = await adminListPosts(req.query.site || null);
    res.json({ posts });
  } catch (error) {
    console.error("❌ Admin campus posts list error:", error.message);
    res.status(500).json({ posts: [], message: error.message });
  }
});

const CAMPUS_POST_TYPES = ["notice", "release", "event", "timetable", "resource"];
const CAMPUS_POST_PRIORITIES = ["normal", "important", "urgent"];

/**
 * POST /api/admin/campus-posts
 * Body: { siteId, type, title, body?, category?, priority?, attachmentUrl?,
 *         eventStartsAt?, eventEndsAt?, location?, isPinned?, sortOrder? }
 * `eventStartsAt`/`eventEndsAt`/`location` only matter for type='event'.
 */
adminRouter.post("/campus-posts", async (req, res) => {
  const { siteId, type, title, priority } = req.body;
  if (!siteId || !type || !title) {
    return res.status(400).json({ success: false, message: "siteId, type, and title are required" });
  }
  if (!CAMPUS_POST_TYPES.includes(type)) {
    return res.status(400).json({ success: false, message: `type must be one of ${CAMPUS_POST_TYPES.join(", ")}` });
  }
  if (priority !== undefined && !CAMPUS_POST_PRIORITIES.includes(priority)) {
    return res.status(400).json({ success: false, message: `priority must be one of ${CAMPUS_POST_PRIORITIES.join(", ")}` });
  }

  try {
    const post = await createCampusPost(req.body);
    res.json({ success: true, post });
  } catch (error) {
    console.error("❌ Admin campus post create error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PATCH /api/admin/campus-posts/:id — partial update; any field from the create body, plus isActive. */
adminRouter.patch("/campus-posts/:id", async (req, res) => {
  if (req.body.type !== undefined && !CAMPUS_POST_TYPES.includes(req.body.type)) {
    return res.status(400).json({ success: false, message: `type must be one of ${CAMPUS_POST_TYPES.join(", ")}` });
  }
  if (req.body.priority !== undefined && !CAMPUS_POST_PRIORITIES.includes(req.body.priority)) {
    return res.status(400).json({ success: false, message: `priority must be one of ${CAMPUS_POST_PRIORITIES.join(", ")}` });
  }

  try {
    const post = await updateCampusPost(req.params.id, req.body);
    if (!post) return res.status(404).json({ success: false, message: "Campus post not found" });
    res.json({ success: true, post });
  } catch (error) {
    console.error("❌ Admin campus post update error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** DELETE /api/admin/campus-posts/:id — deactivates rather than hard-deletes (see services/campusPosts.js). */
adminRouter.delete("/campus-posts/:id", async (req, res) => {
  try {
    const post = await deactivateCampusPost(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: "Campus post not found" });
    res.json({ success: true, post });
  } catch (error) {
    console.error("❌ Admin campus post deactivate error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /api/admin/campus-posts/upload — multipart, field name "file". Same pipeline as /content/upload (images/video); PDFs are also accepted for release attachments. */
adminRouter.post("/campus-posts/upload", (req, res) => {
  uploadContentFile(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    const filename = await optimizeUploadedVideo(req.file);
    res.json({ success: true, url: `/uploads/${filename}` });
  });
});

// ── Activators ───────────────────────────────────────────────────────────

/** GET /api/admin/activators — every activator with performance numbers. */
adminRouter.get("/activators", async (_req, res) => {
  try {
    const activators = await adminListActivators();
    res.json({ activators });
  } catch (error) {
    console.error("❌ Admin activator list error:", error.message);
    res.status(500).json({ activators: [], message: error.message });
  }
});

/**
 * POST /api/admin/activators
 * Body: { code, name, phone, pin, territory?, mpesaNumber?, commissionRate?, coordinatorId? }
 */
adminRouter.post("/activators", async (req, res) => {
  const { code, name, phone, pin } = req.body;
  if (!code || !name || !phone || !pin) {
    return res.status(400).json({ success: false, message: "code, name, phone, and pin are required" });
  }

  try {
    const activator = await createActivator(req.body);
    res.json({ success: true, activator });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "That activator code or phone is already in use." });
    }
    console.error("❌ Admin activator create error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PATCH /api/admin/activators/:id — partial update: name, territory, mpesaNumber, commissionRate, status, coordinatorId, pin. */
adminRouter.patch("/activators/:id", async (req, res) => {
  try {
    const activator = await updateActivator(req.params.id, req.body);
    if (!activator) return res.status(404).json({ success: false, message: "Activator not found" });
    res.json({ success: true, activator });
  } catch (error) {
    console.error("❌ Admin activator update error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Coordinators ─────────────────────────────────────────────────────────

/** GET /api/admin/coordinators — every coordinator with a rollup of their activators' performance. */
adminRouter.get("/coordinators", async (_req, res) => {
  try {
    const coordinators = await adminListCoordinators();
    res.json({ coordinators });
  } catch (error) {
    console.error("❌ Admin coordinator list error:", error.message);
    res.status(500).json({ coordinators: [], message: error.message });
  }
});

/** POST /api/admin/coordinators — Body: { name, phone, pin, territory? } */
adminRouter.post("/coordinators", async (req, res) => {
  const { name, phone, pin } = req.body;
  if (!name || !phone || !pin) {
    return res.status(400).json({ success: false, message: "name, phone, and pin are required" });
  }

  try {
    const coordinator = await createCoordinator(req.body);
    res.json({ success: true, coordinator });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "That phone number is already in use." });
    }
    console.error("❌ Admin coordinator create error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PATCH /api/admin/coordinators/:id — partial update: name, territory, status, pin. */
adminRouter.patch("/coordinators/:id", async (req, res) => {
  try {
    const coordinator = await updateCoordinator(req.params.id, req.body);
    if (!coordinator) return res.status(404).json({ success: false, message: "Coordinator not found" });
    res.json({ success: true, coordinator });
  } catch (error) {
    console.error("❌ Admin coordinator update error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Sites ────────────────────────────────────────────────────────────────

/** GET /api/admin/sites — every site (including suspended). */
adminRouter.get("/sites", async (_req, res) => {
  try {
    const sites = await adminListSites();
    res.json({ sites });
  } catch (error) {
    console.error("❌ Admin sites list error:", error.message);
    res.status(500).json({ sites: [], message: error.message });
  }
});

/**
 * GET /api/admin/sites/unifi-options — real sites known to the UniFi
 * controller, for the "Add Site" form to pick an id from instead of typing
 * one by hand. Returns [] (not an error) if the controller's unreachable
 * or UNIFI_URL isn't configured — the form falls back to manual entry.
 */
adminRouter.get("/sites/unifi-options", async (_req, res) => {
  try {
    const options = await listUnifiSiteOptions();
    res.json({ options: options ?? [] });
  } catch (error) {
    console.error("❌ UniFi sites fetch error:", error.message);
    res.json({ options: [] });
  }
});

const SITE_MODES = ["pay_only", "earn_only", "both"];
const SITE_VERTICALS = ["general", "institution"];

/** POST /api/admin/sites — Body: { id, name, mode?, btcEnabled?, vertical? }. `id` must match the UniFi site's own short id (see schema.sql's comment on sites.id). */
adminRouter.post("/sites", async (req, res) => {
  const { id, name, mode, vertical } = req.body;
  if (!id || !name) {
    return res.status(400).json({ success: false, message: "id and name are required" });
  }
  if (mode !== undefined && !SITE_MODES.includes(mode)) {
    return res.status(400).json({ success: false, message: `mode must be one of ${SITE_MODES.join(", ")}` });
  }
  if (vertical !== undefined && !SITE_VERTICALS.includes(vertical)) {
    return res.status(400).json({ success: false, message: `vertical must be one of ${SITE_VERTICALS.join(", ")}` });
  }
  // Institution sites always need at least the earn-access option available
  // to students — mode/vertical default to "both"/"general" (see
  // createSite), matching those defaults here.
  if ((vertical ?? "general") === "institution" && (mode ?? "both") === "pay_only") {
    return res.status(400).json({ success: false, message: "Institution sites can't be pay-only — students need at least the earn-access option." });
  }

  try {
    const site = await createSite(req.body);
    res.json({ success: true, site });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "That site id is already in use." });
    }
    console.error("❌ Admin site create error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PATCH /api/admin/sites/:id — partial update: name, mode, status, btcEnabled, vertical. */
adminRouter.patch("/sites/:id", async (req, res) => {
  if (req.body.mode !== undefined && !SITE_MODES.includes(req.body.mode)) {
    return res.status(400).json({ success: false, message: `mode must be one of ${SITE_MODES.join(", ")}` });
  }
  if (req.body.vertical !== undefined && !SITE_VERTICALS.includes(req.body.vertical)) {
    return res.status(400).json({ success: false, message: `vertical must be one of ${SITE_VERTICALS.join(", ")}` });
  }

  try {
    // A PATCH is a partial update — either field alone (switching vertical
    // to institution on an already-pay_only site, or switching an
    // institution site's mode to pay_only) must be checked against the
    // OTHER field's current value, not just what's in this request body.
    const current = await getSite(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: "Site not found" });
    const effectiveVertical = req.body.vertical ?? current.vertical;
    const effectiveMode = req.body.mode ?? current.mode;
    if (effectiveVertical === "institution" && effectiveMode === "pay_only") {
      return res.status(400).json({ success: false, message: "Institution sites can't be pay-only — students need at least the earn-access option." });
    }

    const site = await updateSite(req.params.id, req.body);
    if (!site) return res.status(404).json({ success: false, message: "Site not found" });
    res.json({ success: true, site });
  } catch (error) {
    console.error("❌ Admin site update error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** DELETE /api/admin/sites/:id — hard delete; sessions/content/packages fall back gracefully (see deleteSite). */
adminRouter.delete("/sites/:id", async (req, res) => {
  try {
    const site = await deleteSite(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: "Site not found" });
    res.json({ success: true, site });
  } catch (error) {
    console.error("❌ Admin site delete error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Packages ─────────────────────────────────────────────────────────────
// No create route — packages are a small fixed set of plan types seeded in
// schema.sql, not admin-authored. This only covers what multi-site scoping
// needs: seeing/editing every package's price, active state, and sites.

/** GET /api/admin/packages — every package (including inactive), with site assignment. */
adminRouter.get("/packages", async (_req, res) => {
  try {
    const packages = await adminListPackages();
    res.json({ packages });
  } catch (error) {
    console.error("❌ Admin packages list error:", error.message);
    res.status(500).json({ packages: [], message: error.message });
  }
});

/** PATCH /api/admin/packages/:id — partial update: label, priceKes, durationSecs, isActive, siteIds. */
adminRouter.patch("/packages/:id", async (req, res) => {
  try {
    const pkg = await updatePackage(req.params.id, req.body);
    if (!pkg) return res.status(404).json({ success: false, message: "Package not found" });
    res.json({ success: true, package: pkg });
  } catch (error) {
    console.error("❌ Admin package update error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Settings ─────────────────────────────────────────────────────────────

/** GET /api/admin/settings */
adminRouter.get("/settings", async (_req, res) => {
  try {
    const settings = await adminGetSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error("❌ Admin settings fetch error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/admin/settings — Body: { earnConnectThresholdMinutes?, defaultActivatorCommissionPct?, notificationRetentionDays? }.
 * Any combination may be provided in the same request.
 */
adminRouter.patch("/settings", async (req, res) => {
  const { earnConnectThresholdMinutes, defaultActivatorCommissionPct, notificationRetentionDays } = req.body;

  if (
    earnConnectThresholdMinutes === undefined &&
    defaultActivatorCommissionPct === undefined &&
    notificationRetentionDays === undefined
  ) {
    return res.status(400).json({ success: false, message: "Nothing to update" });
  }
  if (earnConnectThresholdMinutes !== undefined && !(Number(earnConnectThresholdMinutes) >= 0)) {
    return res.status(400).json({ success: false, message: "earnConnectThresholdMinutes must be a non-negative number" });
  }
  if (
    defaultActivatorCommissionPct !== undefined &&
    !(Number(defaultActivatorCommissionPct) >= 0 && Number(defaultActivatorCommissionPct) <= 100)
  ) {
    return res.status(400).json({ success: false, message: "defaultActivatorCommissionPct must be between 0 and 100" });
  }
  if (notificationRetentionDays !== undefined && !(Number(notificationRetentionDays) >= 0)) {
    return res.status(400).json({ success: false, message: "notificationRetentionDays must be a non-negative number" });
  }

  try {
    let settings;
    if (earnConnectThresholdMinutes !== undefined) {
      settings = await setEarnConnectThresholdSecs(Number(earnConnectThresholdMinutes) * 60);
    }
    if (defaultActivatorCommissionPct !== undefined) {
      settings = await setDefaultActivatorCommissionRate(Number(defaultActivatorCommissionPct) / 100);
    }
    if (notificationRetentionDays !== undefined) {
      settings = await setNotificationRetentionDays(Number(notificationRetentionDays));
    }
    res.json({ success: true, settings });
  } catch (error) {
    console.error("❌ Admin settings update error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Analytics ────────────────────────────────────────────────────────────

/** GET /api/admin/analytics — Watch & Earn engagement + purchase revenue summary. */
adminRouter.get("/analytics", async (_req, res) => {
  try {
    const analytics = await getAdminAnalytics();
    res.json({ success: true, analytics });
  } catch (error) {
    console.error("❌ Admin analytics error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

const SITE_TIMELINE_GRANULARITIES = ["day", "week", "month"];

/**
 * GET /api/admin/analytics/purchases-by-site?granularity=day|week|month&site=<id>
 * The "View more" drill-down behind the dashboard's compact 14-day chart —
 * same per-site series shape, with a chosen bucket size and an optional
 * single-site filter.
 */
adminRouter.get("/analytics/purchases-by-site", async (req, res) => {
  const granularity = SITE_TIMELINE_GRANULARITIES.includes(req.query.granularity) ? req.query.granularity : "day";
  const siteId = req.query.site || null;

  try {
    const timeline = await getPurchasesBySiteSeries({ granularity, siteId });
    res.json({ success: true, timeline });
  } catch (error) {
    console.error("❌ Admin purchases-by-site error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/analytics/purchases-by-package?granularity=day|week|month&package=<id>
 * The "View more" drill-down behind the dashboard's compact 14-day
 * purchases-by-package chart — same per-package series shape as
 * purchases-by-site, but purchase COUNT (not revenue) is the primary
 * series — see getPurchasesByPackageSeries.
 */
adminRouter.get("/analytics/purchases-by-package", async (req, res) => {
  const granularity = SITE_TIMELINE_GRANULARITIES.includes(req.query.granularity) ? req.query.granularity : "day";
  const packageId = req.query.package || null;

  try {
    const timeline = await getPurchasesByPackageSeries({ granularity, packageId });
    res.json({ success: true, timeline });
  } catch (error) {
    console.error("❌ Admin purchases-by-package error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /api/admin/analytics/content/:id — per-item drill-down, including survey answer breakdown. */
adminRouter.get("/analytics/content/:id", async (req, res) => {
  try {
    const detail = await getContentItemAnalytics(req.params.id);
    if (!detail) return res.status(404).json({ success: false, message: "Content item not found" });
    res.json({ success: true, detail });
  } catch (error) {
    console.error("❌ Admin content analytics error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Minmo (evaluation) ──────────────────────────────────────────────────

/**
 * GET /api/admin/minmo/test — read-only connectivity check (account.get +
 * integrations.pay.listStores) so MINMO_PARTNER_ID/MINMO_API_KEY can be
 * verified from the admin panel before any real integration is built on top.
 */
adminRouter.get("/minmo/test", async (_req, res) => {
  try {
    const { partner, stores } = await testMinmoConnection();
    res.json({ success: true, partner, stores });
  } catch (error) {
    console.error("❌ Minmo connectivity test error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
  }
});
