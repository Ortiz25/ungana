// Persists which staff dashboard (activator/coordinator/admin) is logged
// in, so a browser reload can restore it directly instead of always
// falling through to check-session/packages — see
// routes/[...catchall]/+page.svelte's onMount.
//
// sessionStorage, not localStorage — cleared when the tab closes, so a
// stale login doesn't linger indefinitely; still survives a reload, which
// is the actual complaint this fixes. Deliberately does NOT cover the
// client-facing payment-in-progress screens (payment/initiated/connecting)
// — those track a live async operation server-side, and a reload forcing
// re-verification via check-session is the correct behaviour there, not a
// bug (see the comment in +page.svelte's onMount).
const STORAGE_KEY = 'ungana_dashboard_session';

/** role: 'activator' | 'coordinator' | 'admin'. data: whatever object that login screen already passes to onLogin (must include a `token`, even if undefined for the offline-demo fallback). */
export function saveDashboardSession(role, data) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ role, data }));
  } catch {
    // sessionStorage unavailable (some captive-portal WebViews restrict it)
    // — reload just won't restore, same as today. Not worth surfacing.
  }
}

/** Returns { role, data } or null — never throws (corrupt JSON, storage unavailable). */
export function loadDashboardSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.role || !parsed?.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDashboardSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clean up if storage was never reachable in the first place
  }
}
