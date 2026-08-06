import { Router } from "express";
import { getClientByMac, isUsernameAvailable, getClientAssignedActivator } from "../services/clients.js";

export const clientsRouter = Router();

/** GET /api/clients/by-mac/:mac/username — auto-fill support for checkout. */
clientsRouter.get("/by-mac/:mac/username", async (req, res) => {
  try {
    const client = await getClientByMac(req.params.mac);
    res.json({ username: client?.username ?? null });
  } catch (error) {
    console.error("❌ Client lookup error:", error.message);
    res.status(500).json({ username: null, message: error.message });
  }
});

/**
 * GET /api/clients/by-mac/:mac/activator
 * Auto-fill + lock support for checkout. `locked: true` means this MAC's
 * activator assignment is permanent (see clients.activator_locked) —
 * `activator` is either the assigned one or null (permanently self-onboarded).
 * `locked: false` means still free to choose (new MAC, or no purchase yet).
 */
clientsRouter.get("/by-mac/:mac/activator", async (req, res) => {
  try {
    const result = await getClientAssignedActivator(req.params.mac);
    res.json(result);
  } catch (error) {
    console.error("❌ Client activator lookup error:", error.message);
    res.status(500).json({ locked: false, activator: null, message: error.message });
  }
});

/**
 * GET /api/clients/username-available?username=X&mac=Y
 * Live checkout validation as the user types. `mac` is optional — pass the
 * checking device's MAC so re-checking a username it already owns reports
 * available rather than taken.
 */
clientsRouter.get("/username-available", async (req, res) => {
  const { username, mac } = req.query;
  if (!username) return res.status(400).json({ available: false, message: "username is required" });

  try {
    const available = await isUsernameAvailable(username, mac);
    res.json({ available });
  } catch (error) {
    console.error("❌ Username availability error:", error.message);
    res.status(500).json({ available: false, message: error.message });
  }
});
