import { Router } from "express";
import { verifyActivatorLogin, getActivatorEarnings, updateActivator } from "../services/activators.js";
import { listSessionsForActivator, getActivatorEarningsSeries } from "../services/sessions.js";
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
      mpesaNumber: activator.mpesa_number,
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

/**
 * GET /api/activators/me/earnings/series?days=365 — real, zero-filled daily
 * commission series, oldest to newest. The frontend derives This
 * Week/Month/3-Months/Year totals and charts from this rather than the
 * all-time-only summary above.
 */
activatorsRouter.get("/me/earnings/series", requireActivator, async (req, res) => {
  const days = Math.min(400, Math.max(7, Number(req.query.days) || 365));
  const series = await getActivatorEarningsSeries(req.activator.activatorId, days);
  res.json({ success: true, series });
});

/**
 * PATCH /api/activators/me — self-service profile update.
 * Body: { name?, territory?, mpesaNumber? }. Deliberately narrower than the
 * admin's activator-edit endpoint — commission rate, status, and
 * coordinator assignment are admin-only and can't be touched from here.
 */
activatorsRouter.patch("/me", requireActivator, async (req, res) => {
  const { name, territory, mpesaNumber } = req.body;
  const fields = {};
  if (name !== undefined) fields.name = String(name).trim();
  if (territory !== undefined) fields.territory = String(territory).trim() || null;
  if (mpesaNumber !== undefined) fields.mpesaNumber = String(mpesaNumber).trim() || null;

  if (fields.name === "") return res.status(400).json({ success: false, message: "Name cannot be empty" });

  const activator = await updateActivator(req.activator.activatorId, fields);
  res.json({
    success: true,
    activator: {
      id: activator.id,
      code: activator.code,
      name: activator.name,
      territory: activator.territory,
      mpesaNumber: activator.mpesa_number,
      commissionRate: Number(activator.commission_rate),
    },
  });
});
