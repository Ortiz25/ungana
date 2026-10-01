import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

export function signActivatorToken(activator) {
  return jwt.sign({ activatorId: activator.id, code: activator.code }, JWT_SECRET, { expiresIn: "12h" });
}

/** Protects activator-portal routes; sets req.activator = { activatorId, code }. */
export function requireActivator(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: "Missing bearer token" });

  try {
    req.activator = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

export function signCoordinatorToken(coordinator) {
  return jwt.sign({ coordinatorId: coordinator.id, name: coordinator.name }, JWT_SECRET, { expiresIn: "12h" });
}

/** Protects coordinator-portal routes; sets req.coordinator = { coordinatorId, name }. */
export function requireCoordinator(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: "Missing bearer token" });

  try {
    req.coordinator = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

/** `admin.role` is 'admin' or 'super_admin' (admin_users.role) — carried in the token so requireAdmin/requireSuperAdmin never need a DB round trip to check it. */
export function signAdminToken(admin) {
  return jwt.sign({ adminId: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: "12h" });
}

/** Protects the admin panel API; sets req.admin = { adminId, username, role }. Accepts either role — see requireSuperAdmin for the higher bar. */
export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: "Missing bearer token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "admin" && payload.role !== "super_admin") throw new Error("not an admin token");
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

/** Chain after requireAdmin (which already set req.admin) to additionally require the super_admin role — used for admin-account management. */
export function requireSuperAdmin(req, res, next) {
  if (req.admin?.role !== "super_admin") {
    return res.status(403).json({ success: false, message: "Super admin access required" });
  }
  next();
}
