import { Router } from "express";
import { verifyActivatorLogin, getActivatorEarnings, updateActivator } from "../services/activators.js";
import { listSessionsForActivator, getActivatorEarningsSeries } from "../services/sessions.js";
import { listNotifications, countNotifications, getUnreadCount, markAllRead } from "../services/notifications.js";
import { signActivatorToken, requireActivator } from "../middleware/auth.js";

const NOTIFICATION_TYPES = ["expiring", "dormant", "goalMiss", "newPurchase"];

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
      dailyTargetKes: Number(activator.daily_target_kes),
      weeklyTargetKes: Number(activator.weekly_target_kes),
      notificationPrefs: activator.notification_prefs,
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
 * PATCH /api/activators/me — self-service goal-target + notification-
 * preference update. Body: { dailyTargetKes?, weeklyTargetKes?,
 * notificationPrefs?: { expiring?, dormant?, goalMiss?, newPurchase? } }.
 * Identity/payout fields (name, territory, mpesaNumber) are deliberately
 * NOT editable here anymore — an activator changing their own mpesa payout
 * destination unsupervised is a real fraud vector, so those are admin-only
 * now (see PATCH /api/admin/activators/:id). Goal targets and notification
 * preferences carry no such risk, so self-service stays fine for those.
 */
activatorsRouter.patch("/me", requireActivator, async (req, res) => {
  const { dailyTargetKes, weeklyTargetKes, notificationPrefs } = req.body;
  const fields = {};
  if (dailyTargetKes !== undefined) fields.dailyTargetKes = Number(dailyTargetKes);
  if (weeklyTargetKes !== undefined) fields.weeklyTargetKes = Number(weeklyTargetKes);

  if (
    (fields.dailyTargetKes !== undefined && !(fields.dailyTargetKes > 0)) ||
    (fields.weeklyTargetKes !== undefined && !(fields.weeklyTargetKes > 0))
  ) {
    return res.status(400).json({ success: false, message: "Targets must be positive numbers" });
  }

  if (notificationPrefs !== undefined) {
    if (typeof notificationPrefs !== "object" || notificationPrefs === null || Array.isArray(notificationPrefs)) {
      return res.status(400).json({ success: false, message: "notificationPrefs must be an object" });
    }
    const unknownKey = Object.keys(notificationPrefs).find((k) => !NOTIFICATION_TYPES.includes(k));
    if (unknownKey) {
      return res.status(400).json({ success: false, message: `Unknown notification type: ${unknownKey}` });
    }
    fields.notificationPrefs = notificationPrefs;
  }

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
      dailyTargetKes: Number(activator.daily_target_kes),
      weeklyTargetKes: Number(activator.weekly_target_kes),
      notificationPrefs: activator.notification_prefs,
    },
  });
});

/**
 * GET /api/activators/me/notifications?page=&pageSize= — recent
 * notifications + unread count + total, newest first. `page`/`pageSize`
 * are optional (default page=1, pageSize=30 — the bell dropdown's usual
 * call); the "View all" list passes both for real pagination.
 */
activatorsRouter.get("/me/notifications", requireActivator, async (req, res) => {
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));
  const page = Math.max(1, Number(req.query.page) || 1);

  const [notifications, unreadCount, total] = await Promise.all([
    listNotifications(req.activator.activatorId, { limit: pageSize, offset: (page - 1) * pageSize }),
    getUnreadCount(req.activator.activatorId),
    countNotifications(req.activator.activatorId),
  ]);
  res.json({ success: true, notifications, unreadCount, total, page, pageSize });
});

/** POST /api/activators/me/notifications/read — marks every unread notification as read. */
activatorsRouter.post("/me/notifications/read", requireActivator, async (req, res) => {
  await markAllRead(req.activator.activatorId);
  res.json({ success: true });
});
