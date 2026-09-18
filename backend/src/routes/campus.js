import { Router } from "express";
import { listActivePosts, recordCampusPostClick, castPollVote } from "../services/campusPosts.js";

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
