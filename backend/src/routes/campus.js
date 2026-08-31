import { Router } from "express";
import { listActivePosts } from "../services/campusPosts.js";

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
