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
const TIMEOUT_MS = 5000;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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

/** GET /api/packages */
export function getPackages() {
  return request('/packages');
}

/** GET /api/activators */
export function getActivators() {
  return request('/activators');
}

/** POST /api/initiate-payment */
export function initiatePayment(body) {
  return request('/initiate-payment', { method: 'POST', body: JSON.stringify(body) });
}

/** GET /api/verify-payment/:reference */
export function verifyPayment(reference) {
  return request(`/verify-payment/${encodeURIComponent(reference)}`);
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
