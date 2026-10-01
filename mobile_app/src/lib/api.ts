// Ported from frontend/src/lib/api.js — guest-flow-relevant functions only
// (see the plan doc for phasing; adminX/activatorX/coordinatorX endpoints
// come in a later phase). Same never-throws, { ok, data, status } contract
// as the source, so screen code ports almost verbatim: `if (result.ok) ...`.
import Constants from "expo-constants";

// frontend/src/lib/api.js switches base URL between Vite dev/prod builds via
// import.meta.env; there's no such split here since Expo ships one JS bundle
// to both dev and prod devices. `apiBaseUrl` in app.json's `extra` block is
// the equivalent override point — point it at your backend's real origin for
// a physical device/prod build (localhost only resolves on a simulator
// running on the same machine as the backend).
const API_BASE: string = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? "http://localhost:5000/api";
// Upload endpoints (see adminApi.ts) return a relative "/uploads/…" path —
// resolved against this (API_BASE minus its /api suffix) into a full URL the
// same way frontend/src/lib/api.js's BACKEND_ORIGIN does, so an uploaded
// image/video is immediately usable in an <Image>/video source elsewhere.
export const BACKEND_ORIGIN = API_BASE.replace(/\/api$/, "");
const TIMEOUT_MS = 5000;

// `data` is present on every variant (undefined on the network-error one) so
// call sites can read `result.data` unconditionally, matching how every
// screen actually uses this — mirrors the web app's api.js contract, which
// has no such distinction since JS doesn't type-check property access.
export type ApiResult<T = any> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; data: any }
  | { ok: false; error: unknown; data?: undefined };

// Exported so adminApi.ts (and any later activatorApi.ts/coordinatorApi.ts)
// can reuse the same base URL/timeout/never-throws mechanics instead of
// duplicating them — those are separate files from this one (not merged in)
// purely to keep the guest-flow API surface uncluttered, per this file's own
// header comment.
export async function request<T = any>(path: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<ApiResult<T>> {
  const { timeoutMs = TIMEOUT_MS, ...init } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(init.headers || {}) },
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, data };
    return { ok: true, status: res.status, data };
  } catch (error) {
    return { ok: false, error };
  } finally {
    clearTimeout(timeout);
  }
}

// ── App / catalogue ────────────────────────────────────────────────────────

/** GET /api — health check; { mode, paymentProvider }. */
export function getAppInfo() {
  return request<{ mode: "simulation" | "active"; paymentProvider: string }>("", { method: "GET" });
}

/** GET /api/packages?site=X — site optional. */
export function getPackages(site?: string | null) {
  return request(site ? `/packages?site=${encodeURIComponent(site)}` : "/packages");
}

/** GET /api/activators */
export function getActivators() {
  return request("/activators");
}

/** GET /api/sites/:id — public; { id, name, mode, vertical, btcEnabled }. */
export function getSite(id: string) {
  return request(`/sites/${encodeURIComponent(id)}`);
}

/** GET /api/settings — public, admin-tunable values (e.g. earnConnectThresholdSecs). */
export function getSettings() {
  return request("/settings");
}

// ── Payment ─────────────────────────────────────────────────────────────────

/** POST /api/initiate-payment — 30s timeout, real STK pushes routinely exceed the default. */
export function initiatePayment(body: Record<string, unknown>) {
  return request("/initiate-payment", { method: "POST", body: JSON.stringify(body), timeoutMs: 30000 });
}

/** GET /api/verify-payment/:reference — poll after initiatePayment(). */
export function verifyPayment(reference: string) {
  return request(`/verify-payment/${encodeURIComponent(reference)}`);
}

/** POST /api/initiate-btc-payment — Lightning invoice (BTCPay/Minmo). */
export function initiateBtcPayment(body: Record<string, unknown>) {
  return request("/initiate-btc-payment", { method: "POST", body: JSON.stringify(body), timeoutMs: 10000 });
}

/** GET /api/verify-btc-payment/:reference */
export function verifyBtcPayment(reference: string) {
  return request(`/verify-btc-payment/${encodeURIComponent(reference)}`);
}

// ── Session / clients ───────────────────────────────────────────────────────

/** GET /api/session/:mac — active session countdown lookup by device MAC. */
export function getSessionStatus(mac: string) {
  return request(`/session/${encodeURIComponent(mac)}`);
}

/** GET /api/session/by-username/:username — recovery path for a device with no known MAC yet. */
export function getSessionByUsername(username: string) {
  return request(`/session/by-username/${encodeURIComponent(username)}`);
}

/** GET /api/clients/by-mac/:mac/username — checkout auto-fill. */
export function getUsernameForMac(mac: string) {
  return request(`/clients/by-mac/${encodeURIComponent(mac)}/username`);
}

/** GET /api/clients/username-available?username=X&mac=Y */
export function checkUsernameAvailable(username: string, mac?: string) {
  const params = new URLSearchParams({ username, ...(mac ? { mac } : {}) });
  return request(`/clients/username-available?${params}`);
}

/** GET /api/clients/by-mac/:mac/activator — { locked, activator }. */
export function getActivatorForMac(mac: string) {
  return request(`/clients/by-mac/${encodeURIComponent(mac)}/activator`);
}

// ── Content (Watch & Earn) ───────────────────────────────────────────────────

/** GET /api/content?site=X — live catalogue. */
export function getContent(site?: string | null) {
  return request(site ? `/content?site=${encodeURIComponent(site)}` : "/content");
}

/** GET /api/content/completions?mac=X&site=Y */
export function getContentCompletions(mac: string, site?: string | null) {
  const params = new URLSearchParams({ mac, ...(site ? { site } : {}) });
  return request(`/content/completions?${params}`);
}

/** POST /api/content/:id/complete — Body: { mac, elapsedSecs, response? }. */
export function completeContentItem(id: number | string, body: Record<string, unknown>) {
  return request(`/content/${encodeURIComponent(id)}/complete`, { method: "POST", body: JSON.stringify(body) });
}

/** POST /api/content/:id/impression — fire-and-forget view count. */
export function recordContentImpression(id: number | string) {
  return request(`/content/${encodeURIComponent(id)}/impression`, { method: "POST", body: JSON.stringify({}) });
}

/** GET /api/content/claim-preview?mac=X&requestedMinutes=Y — read-only preview, no claim. */
export function previewClaimAmount(mac: string, requestedMinutes?: number) {
  const params = new URLSearchParams({ mac, ...(requestedMinutes != null ? { requestedMinutes: String(requestedMinutes) } : {}) });
  return request(`/content/claim-preview?${params}`);
}

/** POST /api/content/claim-earned-session — Body: { mac, username?, requestedMinutes?, site? }. 10s timeout. */
export function claimEarnedSession(mac: string, username?: string, requestedMinutes?: number, site?: string | null) {
  return request("/content/claim-earned-session", {
    method: "POST",
    body: JSON.stringify({ mac, username, requestedMinutes, site }),
    timeoutMs: 10000,
  });
}

// ── Campus (institution sites) ───────────────────────────────────────────────

/** GET /api/campus/posts?site=X&type=notice|release|event */
export function getCampusPosts(site: string, type?: string | null) {
  const params = new URLSearchParams({ site, ...(type ? { type } : {}) });
  return request(`/campus/posts?${params}`);
}

export function recordCampusPostClick(id: number | string) {
  return request(`/campus/posts/${encodeURIComponent(id)}/click`, { method: "POST", body: JSON.stringify({}) });
}

export function castCampusPollVote(id: number | string, mac: string, optionIndex: number) {
  return request(`/campus/posts/${encodeURIComponent(id)}/vote`, { method: "POST", body: JSON.stringify({ mac, optionIndex }) });
}

export function getCampusReadIds(mac: string) {
  return request(`/campus/notices/read?mac=${encodeURIComponent(mac)}`);
}

export function markCampusPostRead(id: number | string, mac: string) {
  return request(`/campus/posts/${encodeURIComponent(id)}/read`, { method: "POST", body: JSON.stringify({ mac }) });
}

// ── Community (community sites) ──────────────────────────────────────────────

/** GET /api/community/posts?site=X&type=announcement|event|marketplace|service|poll */
export function getCommunityPosts(site: string, type?: string | null) {
  const params = new URLSearchParams({ site, ...(type ? { type } : {}) });
  return request(`/community/posts?${params}`);
}

export function recordCommunityPostClick(id: number | string) {
  return request(`/community/posts/${encodeURIComponent(id)}/click`, { method: "POST", body: JSON.stringify({}) });
}

export function castCommunityPollVote(id: number | string, mac: string, optionIndex: number) {
  return request(`/community/posts/${encodeURIComponent(id)}/vote`, { method: "POST", body: JSON.stringify({ mac, optionIndex }) });
}

export function getCommunityReadIds(mac: string) {
  return request(`/community/notices/read?mac=${encodeURIComponent(mac)}`);
}

export function markCommunityPostRead(id: number | string, mac: string) {
  return request(`/community/posts/${encodeURIComponent(id)}/read`, { method: "POST", body: JSON.stringify({ mac }) });
}
