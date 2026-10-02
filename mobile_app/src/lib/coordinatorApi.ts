// Ported from frontend/src/lib/api.js's coordinator* exports (self-service
// "me" endpoints only). Kept in its own file matching adminApi.ts's own
// convention/header comment.
import { request, type ApiResult } from "@/lib/api";

function authed(token: string): { headers: Record<string, string> } {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export type CoordinatorProfile = { id: number; name: string; territory: string | null };

export type CoordinatorActivator = {
  id: number;
  code: string;
  name: string;
  territory: string | null;
  status: "active" | "suspended";
  paid_sessions: number;
  gross_kes: number;
  commission_kes: number;
  dormant_count: number;
};

export type CoordinatorEarnings = { paid_sessions: number; gross_kes: number; commission_kes: number; activator_count: number };

export type CoordinatorHistoryBucket = { bucket: string; commission_kes: number };

export type CoordinatorRegion = {
  territory: string;
  activator_count: number;
  paid_sessions: number;
  commission_kes: number;
  dormant_count: number;
  open_escalations: number;
};

export type CoordinatorAccessPoint = { id: string; name: string; status: "online" | "degraded" | "offline" };
export type CoordinatorNetworkStatus = {
  totals: { onlineAPs: number; degradedAPs: number; offlineAPs: number; totalAPs: number; totalClients: number };
  sites: { site: { id: string; name: string }; onlineAPs: number; totalAPs: number; accessPoints: CoordinatorAccessPoint[] }[];
} | null;

export type CoordinatorEscalation = {
  id: number;
  issue: string;
  priority: "low" | "medium" | "high";
  status: "open" | "resolved" | "escalated";
  activator_name?: string | null;
  created_at: string;
};

/** POST /api/coordinators/login — Body: { phone, pin } */
export function coordinatorLogin(phone: string, pin: string): Promise<ApiResult<{ success: boolean; token: string; coordinator: CoordinatorProfile; message?: string }>> {
  return request("/coordinators/login", { method: "POST", body: JSON.stringify({ phone, pin }) });
}

/** GET /api/coordinators/me/activators — activators reporting to this coordinator, with their performance. */
export function getCoordinatorActivators(token: string): Promise<ApiResult<{ success: boolean; activators: CoordinatorActivator[] }>> {
  return request("/coordinators/me/activators", authed(token));
}

/** GET /api/coordinators/me/earnings — this coordinator's team performance rollup. */
export function getCoordinatorEarnings(token: string): Promise<ApiResult<{ success: boolean; earnings: CoordinatorEarnings | null }>> {
  return request("/coordinators/me/earnings", authed(token));
}

/** GET /api/coordinators/me/activators/:id/history?period=week|month|year */
export function getCoordinatorActivatorHistory(
  token: string,
  activatorId: number,
  period: "week" | "month" | "year"
): Promise<ApiResult<{ success: boolean; history: CoordinatorHistoryBucket[] }>> {
  return request(`/coordinators/me/activators/${encodeURIComponent(activatorId)}/history?period=${period}`, authed(token));
}

/** GET /api/coordinators/me/regions — this coordinator's team, rolled up by territory. */
export function getCoordinatorRegions(token: string): Promise<ApiResult<{ success: boolean; regions: CoordinatorRegion[] }>> {
  return request("/coordinators/me/regions", authed(token));
}

/** GET /api/coordinators/me/network-status — live AP online/degraded/offline + connected-client counts. `network` is null if UniFi isn't configured/reachable. */
export function getCoordinatorNetworkStatus(token: string): Promise<ApiResult<{ success: boolean; network: CoordinatorNetworkStatus }>> {
  return request("/coordinators/me/network-status", authed(token));
}

/** GET /api/coordinators/me/escalations — this coordinator's issues, most recent first. */
export function getCoordinatorEscalations(token: string): Promise<ApiResult<{ success: boolean; escalations: CoordinatorEscalation[] }>> {
  return request("/coordinators/me/escalations", authed(token));
}

/** POST /api/coordinators/me/escalations — Body: { issue, priority?, activatorId? } */
export function createCoordinatorEscalation(
  token: string,
  body: { issue: string; priority?: "low" | "medium" | "high"; activatorId?: number }
): Promise<ApiResult<{ success: boolean; escalation: CoordinatorEscalation; message?: string }>> {
  return request("/coordinators/me/escalations", { method: "POST", body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/coordinators/me/escalations/:id — Body: { status } */
export function updateCoordinatorEscalationStatus(
  token: string,
  id: number,
  status: "open" | "resolved" | "escalated"
): Promise<ApiResult<{ success: boolean; escalation: CoordinatorEscalation; message?: string }>> {
  return request(`/coordinators/me/escalations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }), ...authed(token) });
}
