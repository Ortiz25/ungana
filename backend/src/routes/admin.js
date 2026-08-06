import { Router } from "express";
import { verifyAdminLogin } from "../services/admin.js";
import { signAdminToken, requireAdmin } from "../middleware/auth.js";
import {
  adminListAllContent,
  createContentItem,
  updateContentItem,
  deactivateContentItem,
} from "../services/content.js";
import { createActivator, adminListActivators, updateActivator } from "../services/activators.js";
import { createCoordinator, adminListCoordinators, updateCoordinator } from "../services/coordinators.js";
import { uploadContentFile } from "../services/uploads.js";
import { adminGetSettings, setEarnConnectThresholdSecs } from "../services/settings.js";
import { getAdminAnalytics, getContentItemAnalytics } from "../services/analytics.js";

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
 * `surveyQuestions` (array of question strings) only matters for type='survey'.
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
 */
adminRouter.post("/content/upload", (req, res) => {
  uploadContentFile(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    res.json({ success: true, url: `/uploads/${req.file.filename}` });
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

/** PATCH /api/admin/settings — Body: { earnConnectThresholdMinutes }. */
adminRouter.patch("/settings", async (req, res) => {
  const { earnConnectThresholdMinutes } = req.body;
  if (earnConnectThresholdMinutes === undefined || !(Number(earnConnectThresholdMinutes) >= 0)) {
    return res.status(400).json({ success: false, message: "earnConnectThresholdMinutes must be a non-negative number" });
  }

  try {
    const settings = await setEarnConnectThresholdSecs(Number(earnConnectThresholdMinutes) * 60);
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
