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
