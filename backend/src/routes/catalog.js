import { Router } from "express";
import { listActivePackages, listActiveActivators } from "../services/catalog.js";
import { getSite } from "../services/sites.js";

export const catalogRouter = Router();

/**
 * GET /api/packages?site=<id> — public plan catalogue, optionally scoped
 * to a site (see listActivePackages). An earn_only site never sells
 * packages at all, so it gets an empty list here rather than a filtered
 * one — the frontend can then skip straight to the earn flow. `site` is
 * optional and unfiltered when omitted (see listActivePackages's own
 * comment on why — dev environments have no captive-portal URL to read a
 * site from).
 */
catalogRouter.get("/packages", async (req, res) => {
  const { site: siteId } = req.query;
  try {
    if (siteId) {
      const site = await getSite(siteId);
      if (site?.mode === "earn_only") return res.json({ success: true, packages: [] });
    }
    const packages = await listActivePackages(siteId || null);
    res.json({ success: true, packages });
  } catch (error) {
    console.error("❌ List packages error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /api/activators — public referral picker list (name/territory only). */
catalogRouter.get("/activators", async (_req, res) => {
  try {
    const activators = await listActiveActivators();
    res.json({ success: true, activators });
  } catch (error) {
    console.error("❌ List activators error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});
