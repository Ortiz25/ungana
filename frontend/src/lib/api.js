// Thin client for the Ungana backend. Every function returns
// { ok: true, data } on a successful HTTP response, or { ok: false, data?,
// status?, error? } on any failure — network error, timeout, or non-2xx
// response — so callers can uniformly fall back to static demo data
// instead of throwing. Never throws.
//
// Base URL switches automatically between dev and a production build:
//   - `npm run dev`   -> http://localhost:5000/api (backend's own dev port)
//   - `npm run build` -> /backend/api (same-origin, proxied by nginx's
//     `location /backend/ { proxy_pass http://localhost:5000/; }` — see
//     example-nginx-config.txt at the repo root)
// Override either with VITE_API_BASE_URL if you need something else.
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/backend/api');
// Same dev/prod split as API_BASE, minus the /api suffix — for resolving the
// relative "/uploads/…" path the upload endpoint returns into a URL that's
// actually fetchable from the frontend's own origin (or localhost:5000 in dev).
const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || (import.meta.env.DEV ? 'http://localhost:5000' : '/backend');
const TIMEOUT_MS = 5000;

async function request(path, { timeoutMs = TIMEOUT_MS, ...options } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  // FormData needs the browser to set its own multipart boundary — an
  // explicit Content-Type here would break that.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) },
      signal: controller.signal
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, data };
    return { ok: true, status: res.status, data };
  } catch (error) {
    // Network failure, timeout, or backend/DB unreachable.
    return { ok: false, error };
  } finally {
    clearTimeout(timeout);
  }
}

/** GET /api — health check; { mode, paymentProvider }. Used to know whether the backend is running 'simulation' or 'active'. */
export function getAppInfo() {
  return request('', { method: 'GET' });
}

/** GET /api/packages?site=X — site is optional; omitted entirely in dev, where there's no captive-portal URL to read one from. */
export function getPackages(site) {
  return request(site ? `/packages?site=${encodeURIComponent(site)}` : '/packages');
}

/** GET /api/activators */
export function getActivators() {
  return request('/activators');
}

/**
 * POST /api/initiate-payment. A longer timeout than the default: this
 * triggers a real STK push (our backend calling out to Paystack, which
 * itself waits on Safaricom) — that round trip routinely takes longer than
 * the standard 5s, and a spurious timeout here used to get silently
 * swallowed by InitiatedScreen's "no reference" fallback, which granted
 * access without any confirmed payment. Long timeout + a real error state
 * on failure (see InitiatedScreen) is the actual fix; this alone just makes
 * that failure state trigger far less often.
 */
export function initiatePayment(body) {
  return request('/initiate-payment', { method: 'POST', body: JSON.stringify(body), timeoutMs: 30000 });
}

/** GET /api/verify-payment/:reference */
export function verifyPayment(reference) {
  return request(`/verify-payment/${encodeURIComponent(reference)}`);
}

/**
 * POST /api/initiate-btc-payment — generates a Lightning invoice. A real
 * BTCPay round-trip (create invoice + fetch its payment methods) can take
 * longer than the default timeout, so this gets a longer one.
 */
export function initiateBtcPayment(body) {
  return request('/initiate-btc-payment', { method: 'POST', body: JSON.stringify(body), timeoutMs: 10000 });
}

/** GET /api/verify-btc-payment/:reference */
export function verifyBtcPayment(reference) {
  return request(`/verify-btc-payment/${encodeURIComponent(reference)}`);
}

/** GET /api/session/:mac */
export function getSessionStatus(mac) {
  return request(`/session/${encodeURIComponent(mac)}`);
}

/** GET /api/session/by-username/:username */
export function getSessionByUsername(username) {
  return request(`/session/by-username/${encodeURIComponent(username)}`);
}

/** GET /api/clients/by-mac/:mac/username — for checkout auto-fill. */
export function getUsernameForMac(mac) {
  return request(`/clients/by-mac/${encodeURIComponent(mac)}/username`);
}

/** GET /api/clients/username-available?username=X&mac=Y — live checkout validation. */
export function checkUsernameAvailable(username, mac) {
  const params = new URLSearchParams({ username, ...(mac ? { mac } : {}) });
  return request(`/clients/username-available?${params}`);
}

/**
 * GET /api/clients/by-mac/:mac/activator — checkout auto-fill/lock. Returns
 * { locked, activator } — `locked: true` means this MAC's activator
 * assignment is permanent (activator may still be null, meaning
 * self-onboarded); `locked: false` means still free to choose.
 */
export function getActivatorForMac(mac) {
  return request(`/clients/by-mac/${encodeURIComponent(mac)}/activator`);
}

/** GET /api/content?site=X — live Watch & Earn catalogue. `site` is optional (see getPackages). */
export function getContent(site) {
  return request(site ? `/content?site=${encodeURIComponent(site)}` : '/content');
}

/** GET /api/content/completions?mac=X&site=Y — items this device has already finished, for UI restore after reload. */
export function getContentCompletions(mac, site) {
  const params = new URLSearchParams({ mac, ...(site ? { site } : {}) });
  return request(`/content/completions?${params}`);
}

/** POST /api/content/:id/complete — Body: { mac, elapsedSecs, response }. Server validates real dwell time / survey answers before crediting. */
export function completeContentItem(id, body) {
  return request(`/content/${encodeURIComponent(id)}/complete`, { method: 'POST', body: JSON.stringify(body) });
}

/** POST /api/content/:id/impression — fire-and-forget view count, analytics only. */
export function recordContentImpression(id) {
  return request(`/content/${encodeURIComponent(id)}/impression`, { method: 'POST', body: JSON.stringify({}) });
}

/** GET /api/content/claim-preview?mac=X&requestedMinutes=Y — read-only: what claim-earned-session would actually grant, without claiming it. */
export function previewClaimAmount(mac, requestedMinutes) {
  const params = new URLSearchParams({ mac, ...(requestedMinutes ? { requestedMinutes } : {}) });
  return request(`/content/claim-preview?${params}`);
}

/** POST /api/content/claim-earned-session — Body: { mac, username?, site? }. Folds every unclaimed completion into a real, router-authorised session. Rejected server-side on a pay_only site. */
export function claimEarnedSession(mac, username, requestedMinutes, site) {
  return request('/content/claim-earned-session', {
    method: 'POST',
    body: JSON.stringify({
      mac,
      username: username || undefined,
      requestedMinutes: requestedMinutes || undefined,
      site: site || undefined
    }),
    timeoutMs: 10000
  });
}

/** POST /api/activators/login — Body: { phone, pin } */
export function activatorLogin(phone, pin) {
  return request('/activators/login', { method: 'POST', body: JSON.stringify({ phone, pin }) });
}

/** GET /api/activators/me/sessions — Bearer token required */
export function getActivatorSessions(token) {
  return request('/activators/me/sessions', { headers: { Authorization: `Bearer ${token}` } });
}

/** GET /api/activators/me/earnings — Bearer token required */
export function getActivatorEarnings(token) {
  return request('/activators/me/earnings', { headers: { Authorization: `Bearer ${token}` } });
}

/** GET /api/activators/me/earnings/series — real daily commission series. Bearer token required */
export function getActivatorEarningsSeries(token, days = 365) {
  return request(`/activators/me/earnings/series?days=${days}`, { headers: { Authorization: `Bearer ${token}` } });
}

/** PATCH /api/activators/me — Body: { dailyTargetKes?, weeklyTargetKes? }. Self-service goal targets only — identity/payout fields are admin-only. Bearer token required */
export function updateActivatorGoals(token, body) {
  return request('/activators/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

/** PATCH /api/activators/me — Body: { notificationPrefs: { expiring?, dormant?, goalMiss?, newPurchase? } }. Merged, not replaced — only the keys sent are touched. Bearer token required */
export function updateActivatorNotificationPrefs(token, notificationPrefs) {
  return request('/activators/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ notificationPrefs }),
  });
}

/** GET /api/activators/me/notifications?page=&pageSize= — recent notifications + unread count + total. Bearer token required */
export function getActivatorNotifications(token, { page, pageSize } = {}) {
  const params = new URLSearchParams();
  if (page) params.set('page', page);
  if (pageSize) params.set('pageSize', pageSize);
  const qs = params.toString();
  return request(`/activators/me/notifications${qs ? `?${qs}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
}

/** POST /api/activators/me/notifications/read — marks every unread notification as read. Bearer token required */
export function markActivatorNotificationsRead(token) {
  return request('/activators/me/notifications/read', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** POST /api/coordinators/login — Body: { phone, pin } */
export function coordinatorLogin(phone, pin) {
  return request('/coordinators/login', { method: 'POST', body: JSON.stringify({ phone, pin }) });
}

/** GET /api/coordinators/me/activators — Bearer token required */
export function getCoordinatorActivators(token) {
  return request('/coordinators/me/activators', { headers: { Authorization: `Bearer ${token}` } });
}

/** GET /api/coordinators/me/earnings — Bearer token required */
export function getCoordinatorEarnings(token) {
  return request('/coordinators/me/earnings', { headers: { Authorization: `Bearer ${token}` } });
}

/** GET /api/coordinators/me/activators/:id/history?period=week|month|year — Bearer token required */
export function getCoordinatorActivatorHistory(token, activatorId, period) {
  return request(`/coordinators/me/activators/${encodeURIComponent(activatorId)}/history?period=${period}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** GET /api/coordinators/me/regions — Bearer token required */
export function getCoordinatorRegions(token) {
  return request('/coordinators/me/regions', { headers: { Authorization: `Bearer ${token}` } });
}

/** GET /api/coordinators/me/network-status — Bearer token required. `network` is null if UniFi isn't configured/reachable */
export function getCoordinatorNetworkStatus(token) {
  return request('/coordinators/me/network-status', { headers: { Authorization: `Bearer ${token}` } });
}

/** GET /api/coordinators/me/escalations — Bearer token required */
export function getCoordinatorEscalations(token) {
  return request('/coordinators/me/escalations', { headers: { Authorization: `Bearer ${token}` } });
}

/** POST /api/coordinators/me/escalations — Bearer token required. Body: { issue, priority?, activatorId? } */
export function createCoordinatorEscalation(token, { issue, priority, activatorId }) {
  return request('/coordinators/me/escalations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ issue, priority, activatorId })
  });
}

/** PATCH /api/coordinators/me/escalations/:id — Bearer token required. Body: { status } */
export function updateCoordinatorEscalationStatus(token, id, status) {
  return request(`/coordinators/me/escalations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status })
  });
}

// ── Admin panel ──────────────────────────────────────────────────────────
// Every function below (except adminLogin) requires the bearer token
// returned by adminLogin.

function authed(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

/** POST /api/admin/login — Body: { username, password } */
export function adminLogin(username, password) {
  return request('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

/** GET /api/admin/content — every item, including deactivated ones. */
export function adminGetContent(token) {
  return request('/admin/content', authed(token));
}

/** POST /api/admin/content — Body matches services/content.js createContentItem fields. */
export function adminCreateContent(token, body) {
  return request('/admin/content', { method: 'POST', body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/admin/content/:id — partial update. */
export function adminUpdateContent(token, id, body) {
  return request(`/admin/content/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body), ...authed(token) });
}

/** DELETE /api/admin/content/:id — deactivates (soft-delete). */
export function adminDeleteContent(token, id) {
  return request(`/admin/content/${encodeURIComponent(id)}`, { method: 'DELETE', ...authed(token) });
}

/**
 * POST /api/admin/content/upload — uploads an image/video file (admin
 * content form's "or upload a file" option). Resolves the backend's
 * relative "/uploads/…" response into a full URL so the caller can drop it
 * straight into imgUrl/bodyUrl with no further logic needed.
 */
export async function adminUploadContentFile(token, file) {
  const formData = new FormData();
  formData.append('file', file);
  // 4 minutes — video uploads are now transcoded server-side before the
  // response comes back (see optimizeUploadedVideo), which can take
  // noticeably longer than a plain file save for a multi-minute clip.
  const result = await request('/admin/content/upload', { method: 'POST', body: formData, timeoutMs: 240000, ...authed(token) });
  if (result.ok && result.data?.url) {
    return { ...result, data: { ...result.data, url: `${BACKEND_ORIGIN}${result.data.url}` } };
  }
  return result;
}

/** GET /api/admin/activators — every activator with performance numbers. */
export function adminGetActivators(token) {
  return request('/admin/activators', authed(token));
}

/** POST /api/admin/activators — Body: { code, name, phone, pin, territory?, mpesaNumber?, commissionRate?, coordinatorId? } */
export function adminCreateActivator(token, body) {
  return request('/admin/activators', { method: 'POST', body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/admin/activators/:id — partial update, including status suspend/activate. */
export function adminUpdateActivator(token, id, body) {
  return request(`/admin/activators/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body), ...authed(token) });
}

/** GET /api/admin/coordinators — every coordinator with a performance rollup of their activators. */
export function adminGetCoordinators(token) {
  return request('/admin/coordinators', authed(token));
}

/** POST /api/admin/coordinators — Body: { name, phone, pin, territory? } */
export function adminCreateCoordinator(token, body) {
  return request('/admin/coordinators', { method: 'POST', body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/admin/coordinators/:id — partial update, including status suspend/activate. */
export function adminUpdateCoordinator(token, id, body) {
  return request(`/admin/coordinators/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body), ...authed(token) });
}

/** GET /api/settings — public, admin-tunable values (e.g. { earnConnectThresholdSecs }). */
export function getSettings() {
  return request('/settings');
}

/** GET /api/sites/:id — public; { id, name, mode }. Used to decide whether to show the pay flow, the earn flow, or both. */
export function getSite(id) {
  return request(`/sites/${encodeURIComponent(id)}`);
}

/** GET /api/admin/settings */
export function adminGetSettings(token) {
  return request('/admin/settings', authed(token));
}

/** PATCH /api/admin/settings — Body: { earnConnectThresholdMinutes }. */
export function adminUpdateSettings(token, body) {
  return request('/admin/settings', { method: 'PATCH', body: JSON.stringify(body), ...authed(token) });
}

/** GET /api/admin/analytics — Watch & Earn engagement + purchase revenue summary. */
export function adminGetAnalytics(token) {
  return request('/admin/analytics', authed(token));
}

/** GET /api/admin/analytics/content/:id — per-item drill-down, including survey answer breakdown. */
export function adminGetContentAnalytics(token, id) {
  return request(`/admin/analytics/content/${encodeURIComponent(id)}`, authed(token));
}

/** GET /api/admin/analytics/purchases-by-site?granularity=day|week|month&site=<id> — the "View more" drill-down behind the compact chart. */
export function adminGetPurchasesBySite(token, { granularity, siteId } = {}) {
  const params = new URLSearchParams({ granularity: granularity || 'day', ...(siteId ? { site: siteId } : {}) });
  return request(`/admin/analytics/purchases-by-site?${params}`, authed(token));
}

/** GET /api/admin/analytics/purchases-by-package?granularity=day|week|month&package=<id> — the "View more" drill-down behind the compact chart. */
export function adminGetPurchasesByPackage(token, { granularity, packageId } = {}) {
  const params = new URLSearchParams({ granularity: granularity || 'day', ...(packageId ? { package: packageId } : {}) });
  return request(`/admin/analytics/purchases-by-package?${params}`, authed(token));
}

// ── Sites ────────────────────────────────────────────────────────────────

/** GET /api/admin/sites — every site (including suspended). */
export function adminGetSites(token) {
  return request('/admin/sites', authed(token));
}

/** GET /api/admin/sites/unifi-options — real sites known to the UniFi controller, for the "Add Site" picker. [] if the controller's unreachable. */
export function adminGetUnifiSiteOptions(token) {
  return request('/admin/sites/unifi-options', authed(token));
}

/** POST /api/admin/sites — Body: { id, name, mode? }. `id` must match the UniFi site's own short id. */
export function adminCreateSite(token, body) {
  return request('/admin/sites', { method: 'POST', body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/admin/sites/:id — partial update: name, mode, status. */
export function adminUpdateSite(token, id, body) {
  return request(`/admin/sites/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body), ...authed(token) });
}

/** DELETE /api/admin/sites/:id — hard delete. */
export function adminDeleteSite(token, id) {
  return request(`/admin/sites/${encodeURIComponent(id)}`, { method: 'DELETE', ...authed(token) });
}

// ── Packages ─────────────────────────────────────────────────────────────
// No admin-create — packages are a small fixed set of plan types, not
// admin-authored (see services/catalog.js).

/** GET /api/admin/packages — every package (including inactive), with site assignment. */
export function adminGetPackages(token) {
  return request('/admin/packages', authed(token));
}

/** PATCH /api/admin/packages/:id — partial update: label, priceKes, durationSecs, isActive, siteIds. */
export function adminUpdatePackage(token, id, body) {
  return request(`/admin/packages/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body), ...authed(token) });
}
