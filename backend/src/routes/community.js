import { Router } from "express";
import { listActivePosts, recordCommunityPostClick, castPollVote } from "../services/communityPosts.js";

export const communityRouter = Router();

/**
 * GET /api/community/posts?site=<id>&type=announcement|event|marketplace|service|poll
 * — public feed for a community site's Board/Events/Marketplace/Services/
 * Polls. `site` is required (a community post always belongs to exactly one
 * site — see community_posts' schema comment); `type` is optional and
 * narrows to one kind. Returns [] for a bogus/missing `site` rather than an
 * error — same convention as campus.js's GET /posts.
 */
communityRouter.get("/posts", async (req, res) => {
  const { site, type } = req.query;
  if (!site) return res.json({ posts: [] });

  try {
    const posts = await listActivePosts(site, type || null);
    res.json({ posts });
  } catch (error) {
    console.error("❌ Community posts fetch error:", error.message);
    res.status(500).json({ posts: [], message: error.message });
  }
});

/**
 * POST /api/community/posts/:id/click — fired when a client taps a
 * Marketplace listing or Local Services tile, independent of whether the
 * link/contact action actually completes. Fire-and-forget from the
 * frontend (analytics only) — same shape as campus.js's /:id/click.
 */
communityRouter.post("/posts/:id/click", async (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isInteger(postId)) return res.status(400).json({ ok: false, message: "invalid post id" });

  try {
    await recordCommunityPostClick(postId);
    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Community post click error:", error.message);
    res.status(500).json({ ok: false, message: error.message });
  }
});

/**
 * POST /api/community/posts/:id/vote — Body: { mac, optionIndex }. Casts
 * this device's vote on a poll (locked in once cast — see
 * services/communityPosts.js's castPollVote) and always returns the fresh
 * per-option tallies, whether this call just voted or the device had
 * already voted earlier.
 */
communityRouter.post("/posts/:id/vote", async (req, res) => {
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
    console.error("❌ Community poll vote error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});
