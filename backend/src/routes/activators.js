import { Router } from "express";
import { verifyActivatorLogin, getActivatorEarnings } from "../services/activators.js";
import { listSessionsForActivator } from "../services/sessions.js";
import { signActivatorToken, requireActivator } from "../middleware/auth.js";

export const activatorsRouter = Router();

/** POST /api/activators/login — Body: { phone, pin }. */
activatorsRouter.post("/login", async (req, res) => {
  const { phone, pin } = req.body;
  if (!phone || !pin) return res.status(400).json({ success: false, message: "phone and pin are required" });

  const activator = await verifyActivatorLogin(phone, pin);
  if (!activator) return res.status(401).json({ success: false, message: "Invalid phone or PIN" });

  const token = signActivatorToken(activator);
  res.json({
    success: true,
    token,
    activator: {
      id: activator.id,
      code: activator.code,
      name: activator.name,
      territory: activator.territory,
      commissionRate: Number(activator.commission_rate),
    },
  });
});

/** GET /api/activators/me/sessions — the logged-in activator's referred sessions. */
activatorsRouter.get("/me/sessions", requireActivator, async (req, res) => {
  const sessions = await listSessionsForActivator(req.activator.activatorId);
  res.json({ success: true, sessions });
});

/** GET /api/activators/me/earnings — paid session count, gross + commission totals. */
activatorsRouter.get("/me/earnings", requireActivator, async (req, res) => {
  const earnings = await getActivatorEarnings(req.activator.activatorId);
  res.json({ success: true, earnings });
});
