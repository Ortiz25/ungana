// Ported from frontend/src/lib/api.js's activator* exports — self-service
// endpoints only (getActivators/getActivatorForMac already live in api.ts
// for the guest-flow's ActivatorDropdown). Kept in its own file matching
// adminApi.ts's own convention/header comment.
import { request, type ApiResult } from "@/lib/api";

function authed(token: string): { headers: Record<string, string> } {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export type ActivatorNotificationPrefs = { expiring: boolean; dormant: boolean; goalMiss: boolean; newPurchase: boolean };

export type ActivatorProfile = {
  id: number;
  code: string;
  name: string;
  territory: string | null;
  mpesaNumber: string | null;
  commissionRate: number;
  dailyTargetKes: number;
  weeklyTargetKes: number;
  notificationPrefs: ActivatorNotificationPrefs;
};

export type ActivatorSession = {
  id: string;
  client_mac: string;
  client_phone: string | null;
  client_username: string | null;
  package_id: string;
  commission_kes: number;
  payment_status: "pending" | "paid" | "success" | "failed";
  expires_at: string | null;
  created_at: string;
};

export type ActivatorEarnings = { paid_sessions: number; gross_kes: number; commission_kes: number };

export type ActivatorNotification = { id: number; title: string; body?: string | null; created_at: string };

/** POST /api/activators/login — Body: { phone, pin } */
export function activatorLogin(phone: string, pin: string): Promise<ApiResult<{ success: boolean; token: string; activator: ActivatorProfile; message?: string }>> {
  return request("/activators/login", { method: "POST", body: JSON.stringify({ phone, pin }) });
}

/** GET /api/activators/me/sessions */
export function getActivatorSessions(token: string): Promise<ApiResult<{ success: boolean; sessions: ActivatorSession[] }>> {
  return request("/activators/me/sessions", authed(token));
}

/** GET /api/activators/me/earnings */
export function getActivatorEarnings(token: string): Promise<ApiResult<{ success: boolean; earnings: ActivatorEarnings | null }>> {
  return request("/activators/me/earnings", authed(token));
}

/** GET /api/activators/me/earnings/series?days= — real, zero-filled daily commission series, oldest to newest. */
export function getActivatorEarningsSeries(
  token: string,
  days = 365
): Promise<ApiResult<{ success: boolean; series: { date: string; commissionKes: number }[] }>> {
  return request(`/activators/me/earnings/series?days=${days}`, authed(token));
}

/** PATCH /api/activators/me — Body: { dailyTargetKes?, weeklyTargetKes? }. Goal targets only — identity/payout fields are admin-only. */
export function updateActivatorGoals(
  token: string,
  body: { dailyTargetKes?: number; weeklyTargetKes?: number }
): Promise<ApiResult<{ success: boolean; activator: ActivatorProfile }>> {
  return request("/activators/me", { method: "PATCH", body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/activators/me — Body: { notificationPrefs }. Merged, not replaced — only the keys sent are touched. */
export function updateActivatorNotificationPrefs(
  token: string,
  notificationPrefs: Partial<ActivatorNotificationPrefs>
): Promise<ApiResult<{ success: boolean; activator: ActivatorProfile }>> {
  return request("/activators/me", { method: "PATCH", body: JSON.stringify({ notificationPrefs }), ...authed(token) });
}

/** GET /api/activators/me/notifications?page=&pageSize= — recent notifications + unread count + total. */
export function getActivatorNotifications(
  token: string,
  { page, pageSize }: { page?: number; pageSize?: number } = {}
): Promise<ApiResult<{ success: boolean; notifications: ActivatorNotification[]; unreadCount: number; total: number; page: number; pageSize: number }>> {
  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (pageSize) params.set("pageSize", String(pageSize));
  const qs = params.toString();
  return request(`/activators/me/notifications${qs ? `?${qs}` : ""}`, authed(token));
}

/** POST /api/activators/me/notifications/read — marks every unread notification as read. */
export function markActivatorNotificationsRead(token: string): Promise<ApiResult<{ success: boolean }>> {
  return request("/activators/me/notifications/read", { method: "POST", ...authed(token) });
}
