import { Router } from "express";
import { verifyCoordinatorLogin, getCoordinatorEarnings, getActivatorsForCoordinator } from "../services/coordinators.js";
import { signCoordinatorToken, requireCoordinator } from "../middleware/auth.js";

export const coordinatorsRouter = Router();

/** POST /api/coordinators/login — Body: { phone, pin }. */
coordinatorsRouter.post("/login", async (req, res) => {
  const { phone, pin } = req.body;
  if (!phone || !pin) return res.status(400).json({ success: false, message: "phone and pin are required" });

  const coordinator = await verifyCoordinatorLogin(phone, pin);
  if (!coordinator) return res.status(401).json({ success: false, message: "Invalid phone or PIN" });

  const token = signCoordinatorToken(coordinator);
  res.json({
    success: true,
    token,
    coordinator: { id: coordinator.id, name: coordinator.name, territory: coordinator.territory },
  });
});

/** GET /api/coordinators/me/activators — activators reporting to this coordinator, with their performance. */
coordinatorsRouter.get("/me/activators", requireCoordinator, async (req, res) => {
  const activators = await getActivatorsForCoordinator(req.coordinator.coordinatorId);
  res.json({ success: true, activators });
});

/** GET /api/coordinators/me/earnings — this coordinator's team performance rollup. */
coordinatorsRouter.get("/me/earnings", requireCoordinator, async (req, res) => {
  const earnings = await getCoordinatorEarnings(req.coordinator.coordinatorId);
  res.json({ success: true, earnings });
});
