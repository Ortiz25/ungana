// Shared by app/index.tsx (auto mac-based check on launch) and
// app/check-session.tsx (manual username lookup) — both apply a
// GET /session/... response to FlowContext and need the same target route.
// Ported from +page.svelte's buildPkgFromSession/applySessionData.
import { Zap } from "lucide-react-native";
import { PACKAGES, type Package } from "@/lib/data";
import type { FlowContextValue } from "@/flow/FlowContext";

export type SessionData = {
  found?: boolean;
  active?: boolean;
  type?: "earned" | "time";
  expiresAt?: number | null;
  durationSecs?: number | null;
  packageId?: string;
  phone?: string | null;
  serverNow?: number;
};

// 'earned' sessions (claim-earned-session) aren't in PACKAGES — that array
// is the purchase-screen catalogue, and 'earned' isn't something a client
// can buy. Handled separately so it can never leak into package selection.
export const EARNED_PKG_BASE: Omit<Package, "demoSecs"> = {
  id: "earned",
  label: "Earned",
  duration: "Earned access",
  price: 0,
  icon: Zap,
  badge: "Earned via content",
};

export function buildPkgFromSession(data: SessionData): Package | null {
  if (data.packageId === "earned") {
    return { ...EARNED_PKG_BASE, demoSecs: data.durationSecs ?? 0 };
  }
  const local = PACKAGES.find((p) => p.id === data.packageId);
  if (!local) return null;
  return { ...local, demoSecs: data.durationSecs ?? local.demoSecs };
}

/** Applies a session payload to FlowContext and returns the route to navigate to, or null if the payload didn't map to a package we know how to render (caller should treat as "not found"). */
export function applySessionData(flow: FlowContextValue, data: SessionData): "/active" | "/ended" | null {
  const restoredPkg = buildPkgFromSession(data);
  if (!restoredPkg) return null;

  flow.setSelectedPkg(restoredPkg);
  flow.setPhone(data.phone ? data.phone.replace(/^\+?254/, "") : "");

  if (data.active) {
    const serverNow = data.serverNow ?? Date.now();
    const remaining = data.expiresAt ? Math.max(0, Math.round((data.expiresAt - serverNow) / 1000)) : restoredPkg.demoSecs;
    flow.setActiveInitialRemaining(remaining);
    flow.setCameFromConnecting(false); // restoring an existing session, not a fresh payment
    return "/active";
  }
  return "/ended";
}
