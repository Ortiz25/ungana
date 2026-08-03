import { Router } from "express";
import { listActivePackages, listActiveActivators } from "../services/catalog.js";

export const catalogRouter = Router();

/** GET /api/packages — public plan catalogue. */
catalogRouter.get("/packages", async (_req, res) => {
  try {
    const packages = await listActivePackages();
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
