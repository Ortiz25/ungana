import { Router } from "express";
import { listActivePosts, recordCampusPostClick, castPollVote, markPostRead, getReadPostIds } from "../services/campusPosts.js";

export const campusRouter = Router();

/**
 * GET /api/campus/posts?site=<id>&type=notice|release|event — public feed
 * for an institution site's Notice Board / Campus Events. `site` is required
 * (unlike /api/content, a campus post always belongs to exactly one site —
 * see campus_posts' schema comment); `type` is optional and narrows to one
 * kind. Returns [] for a non-institution site rather than an error — the
 * frontend only calls this when sites.vertical === 'institution', but a
 * bogus/missing `site` shouldn't 500.
 */
campusRouter.get("/posts", async (req, res) => {
  const { site, type } = req.query;
  if (!site) return res.json({ posts: [] });

  try {
    const posts = await listActivePosts(site, type || null);
    res.json({ posts });
  } catch (error) {
    console.error("❌ Campus posts fetch error:", error.message);
    res.status(500).json({ posts: [], message: error.message });
  }
});

/**
 * POST /api/campus/posts/:id/click — fired when a client taps a Quick Links
 * (resource) tile, independent of whether the link actually loads. Fire-
 * and-forget from the frontend (analytics only, never blocks the outbound
 * navigation) — no mac/body needed since this is an aggregate count, not a
 * per-client record. Same shape as content.js's /:id/impression.
 */
campusRouter.post("/posts/:id/click", async (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isInteger(postId)) return res.status(400).json({ ok: false, message: "invalid post id" });

  try {
    await recordCampusPostClick(postId);
    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Campus post click error:", error.message);
    res.status(500).json({ ok: false, message: error.message });
  }
});

/**
 * GET /api/campus/notices/read?mac=<mac> — every post id this device has
 * already read, so the Notice Board can render read/unread state on load
 * without a per-notice round trip. `mac` is required — no meaningful
 * response without a device to key off of.
 */
campusRouter.get("/notices/read", async (req, res) => {
  const { mac } = req.query;
  if (!mac) return res.json({ readIds: [] });

  try {
    const readIds = await getReadPostIds(mac);
    res.json({ readIds });
  } catch (error) {
    console.error("❌ Campus notice read-ids fetch error:", error.message);
    res.status(500).json({ readIds: [], message: error.message });
  }
});

/**
 * POST /api/campus/posts/:id/read — Body: { mac }. Marks this device as
 * having read this post — idempotent (see services/campusPosts.js's
 * markPostRead), so calling it again for an already-read post is harmless.
 */
campusRouter.post("/posts/:id/read", async (req, res) => {
  const postId = Number(req.params.id);
  const { mac } = req.body;
  if (!Number.isInteger(postId)) return res.status(400).json({ ok: false, message: "invalid post id" });
  if (!mac) return res.status(400).json({ ok: false, message: "mac is required" });

  try {
    await markPostRead(postId, mac);
    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Campus post read error:", error.message);
    res.status(500).json({ ok: false, message: error.message });
  }
});

/**
 * POST /api/campus/posts/:id/vote — Body: { mac, optionIndex }. Casts this
 * device's vote on a campus poll (locked in once cast — see
 * services/campusPosts.js's castPollVote) and always returns the fresh
 * per-option tallies. Same shape as community.js's /:id/vote.
 */
campusRouter.post("/posts/:id/vote", async (req, res) => {
  const postId = Number(req.params.id);
  const { mac, optionIndex } = req.body;
  if (!Number.isInteger(postId)) return res.status(400).json({ success: false, message: "invalid post id" });
  if (!mac) return res.status(400).json({ success: false, message: "mac is required" });
  if (!Number.isInteger(optionIndex) || optionIndex < 0) {
    return res.status(400).json({ success: false, message: "optionIndex must be a non-negative integer" });
  }

  try {
    const results = await castPollVote(postId, mac, optionIndex);
    res.json({ success: true, results });
  } catch (error) {
    console.error("❌ Campus poll vote error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});
