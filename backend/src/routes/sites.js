import { Router } from "express";
import { getSite } from "../services/sites.js";

export const sitesRouter = Router();

/**
 * GET /api/sites/:id — public. The frontend needs a site's `mode` before
 * any login/purchase happens (to decide whether to show the pay flow, the
 * earn flow, or both), so this can't be admin-gated like the rest of
 * sites management is. Deliberately returns just id/name/mode — nothing
 * about status is needed client-side (a suspended site's guest portal
 * shouldn't be reachable at the network level in the first place).
 */
sitesRouter.get("/:id", async (req, res) => {
  try {
    const site = await getSite(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: "Unknown site" });
    res.json({ success: true, site: { id: site.id, name: site.name, mode: site.mode } });
  } catch (error) {
    console.error("❌ Site fetch error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});
