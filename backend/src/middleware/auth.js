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

export function signAdminToken(admin) {
  return jwt.sign({ adminId: admin.id, username: admin.username, role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
}

/** Protects the admin panel API; sets req.admin = { adminId, username, role }. */
export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: "Missing bearer token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "admin") throw new Error("not an admin token");
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}
