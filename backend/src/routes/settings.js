import { Router } from "express";
import { getPublicSettings } from "../services/settings.js";

export const settingsRouter = Router();

/** GET /api/settings — public, admin-tunable values the frontend needs (e.g. the Earn Free Access connect threshold). */
settingsRouter.get("/", async (_req, res) => {
  try {
    const settings = await getPublicSettings();
    res.json(settings);
  } catch (error) {
    console.error("❌ Settings fetch error:", error.message);
    res.status(500).json({ message: error.message });
  }
});
