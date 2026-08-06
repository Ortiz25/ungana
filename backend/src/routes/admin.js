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

/**
 * POST /api/admin/content
 * Body: { type, section?, title, category?, durationLabel?, earnSecs,
 *         minWatchSecs?, imgUrl?, bodyUrl?, surveyQuestions?, sortOrder? }
 * `section` picks which landing-feed zone this appears in — defaults to
 * 'whats_new' if omitted. `surveyQuestions` (array of question strings)
 * only matters for type='survey'.
 */
adminRouter.post("/content", async (req, res) => {
  const { type, title, earnSecs, section } = req.body;
  if (!type || !title || earnSecs === undefined) {
    return res.status(400).json({ success: false, message: "type, title, and earnSecs are required" });
  }
  if (!["video", "article", "survey", "lesson"].includes(type)) {
    return res.status(400).json({ success: false, message: "type must be one of video, article, survey, lesson" });
  }
  if (section !== undefined && !CONTENT_SECTIONS.includes(section)) {
    return res.status(400).json({ success: false, message: `section must be one of ${CONTENT_SECTIONS.join(", ")}` });
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
