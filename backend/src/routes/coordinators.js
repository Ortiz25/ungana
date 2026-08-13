import { Router } from "express";
import {
  verifyCoordinatorLogin,
  getCoordinatorEarnings,
  getActivatorsForCoordinator,
  getActivatorHistoryForCoordinator,
  getRegionsForCoordinator,
} from "../services/coordinators.js";
import { listEscalationsForCoordinator, createEscalation, updateEscalationStatus } from "../services/escalations.js";
import { getNetworkSummary } from "../services/unifi.js";
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

/**
 * GET /api/coordinators/me/activators/:id/history?period=week|month|year
 * Bucketed paid_sessions/gross_kes/commission_kes for one of this
 * coordinator's activators — powers the drill-down charts.
 */
coordinatorsRouter.get("/me/activators/:id/history", requireCoordinator, async (req, res) => {
  const activatorId = Number(req.params.id);
  const { period } = req.query;

  if (!Number.isInteger(activatorId)) {
    return res.status(400).json({ success: false, message: "invalid activator id" });
  }
  if (!["week", "month", "year"].includes(period)) {
    return res.status(400).json({ success: false, message: "period must be week, month, or year" });
  }

  const history = await getActivatorHistoryForCoordinator(req.coordinator.coordinatorId, activatorId, period);
  if (history === null) {
    return res.status(404).json({ success: false, message: "Activator not found" });
  }
  res.json({ success: true, history });
});

/** GET /api/coordinators/me/regions — this coordinator's team, rolled up by territory. */
coordinatorsRouter.get("/me/regions", requireCoordinator, async (req, res) => {
  const regions = await getRegionsForCoordinator(req.coordinator.coordinatorId);
  res.json({ success: true, regions });
});

/**
 * GET /api/coordinators/me/network-status — live AP online/degraded/offline
 * + connected-client counts across every UniFi site, straight from the
 * controller (one request per site, not cached). `network` is null when
 * UNIFI_URL isn't configured or the console is unreachable — that's a
 * normal "nothing to show" case, not an error.
 */
coordinatorsRouter.get("/me/network-status", requireCoordinator, async (_req, res) => {
  const network = await getNetworkSummary();
  res.json({ success: true, network });
});

/** GET /api/coordinators/me/escalations — this coordinator's issues, most recent first. */
coordinatorsRouter.get("/me/escalations", requireCoordinator, async (req, res) => {
  const escalations = await listEscalationsForCoordinator(req.coordinator.coordinatorId);
  res.json({ success: true, escalations });
});

/** POST /api/coordinators/me/escalations — Body: { issue, priority?, activatorId? }. */
coordinatorsRouter.post("/me/escalations", requireCoordinator, async (req, res) => {
  const { issue, priority, activatorId } = req.body;

  if (!issue || !issue.trim()) {
    return res.status(400).json({ success: false, message: "issue is required" });
  }
  if (priority && !["low", "medium", "high"].includes(priority)) {
    return res.status(400).json({ success: false, message: "priority must be low, medium, or high" });
  }

  const escalation = await createEscalation(req.coordinator.coordinatorId, {
    issue: issue.trim(),
    priority: priority || "medium",
    activatorId: activatorId ?? null,
  });
  if (escalation === null) {
    return res.status(400).json({ success: false, message: "activatorId does not report to this coordinator" });
  }
  res.json({ success: true, escalation });
});

/** PATCH /api/coordinators/me/escalations/:id — Body: { status }. */
coordinatorsRouter.patch("/me/escalations/:id", requireCoordinator, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: "invalid id" });
  if (!["open", "resolved", "escalated"].includes(status)) {
    return res.status(400).json({ success: false, message: "status must be open, resolved, or escalated" });
  }

  const escalation = await updateEscalationStatus(req.coordinator.coordinatorId, id, status);
  if (!escalation) return res.status(404).json({ success: false, message: "Escalation not found" });
  res.json({ success: true, escalation });
});
