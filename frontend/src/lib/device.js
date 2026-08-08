// Browsers cannot read a device's real MAC address. A real deployment
// redirects into this portal from the router/AP with the client's MAC in
// the URL (UniFi's guest portal does this via `?id=<mac>&ap=...`). We read
// that first; standalone (no router redirect — e.g. local dev), we fall
// back to a random MAC persisted in localStorage so repeat visits keep the
// same demo "device" identity.
const MAC_STORAGE_KEY = 'ungana_client_mac';
const ROUTER_PARAM_NAMES = ['id', 'mac', 'client_mac'];

function randomMac() {
  const bytes = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256));
  bytes[0] = (bytes[0] & 0xfe) | 0x02; // locally administered, unicast
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join(':');
}

/**
 * Resolves the client MAC and always persists it to localStorage — whether
 * it came from the router's redirect params or was freshly generated — so
 * it stays queryable/reusable for the rest of the session (e.g. re-reading
 * it on a later page load where the URL params are no longer present, or
 * feeding it into GET /api/session/:mac) without needing the URL each time.
 */
export function getClientMac() {
  if (typeof window === 'undefined') return '00:00:00:00:00:00';

  const params = new URLSearchParams(window.location.search);
  for (const name of ROUTER_PARAM_NAMES) {
    const value = params.get(name);
    if (value) {
      const mac = value.toLowerCase();
      localStorage.setItem(MAC_STORAGE_KEY, mac);
      return mac;
    }
  }

  let mac = localStorage.getItem(MAC_STORAGE_KEY);
  if (!mac) {
    mac = randomMac();
    localStorage.setItem(MAC_STORAGE_KEY, mac);
  }
  return mac;
}

/** Reads the persisted MAC without resolving/generating a new one — null if none stored yet. */
export function getStoredClientMac() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(MAC_STORAGE_KEY);
}

// ─── Multi-site ──────────────────────────────────────────────────────────
// A real deployment's captive-portal redirect carries the UniFi site id in
// the URL, e.g. https://captive.ungana.africa/guest/s/99kv3joz?ap=...&id=...
// — the `/s/<id>/` path segment. Some configurations may instead pass it
// as a `site`/`s` query param, so both are checked.
const SITE_STORAGE_KEY = 'ungana_site_id';
const AP_STORAGE_KEY = 'ungana_ap_mac';
const SSID_STORAGE_KEY = 'ungana_ssid';

/**
 * Resolves the site id and persists it to localStorage (like
 * getClientMac()) so it survives later page loads once the URL params are
 * gone. Unlike the MAC, there's deliberately no synthetic fallback — local
 * dev never sees a real captive-portal redirect, so this returns null
 * there, and every site-aware API call treats null as "don't filter by
 * site" rather than "filter to nothing" (see the backend's
 * listActiveContent/listActivePackages for the matching convention).
 */
export function getSiteId() {
  if (typeof window === 'undefined') return null;

  const pathMatch = window.location.pathname.match(/\/s\/([^/?]+)/);
  const params = new URLSearchParams(window.location.search);
  const siteId = pathMatch?.[1] || params.get('site') || params.get('s');

  if (siteId) {
    localStorage.setItem(SITE_STORAGE_KEY, siteId);
    return siteId;
  }
  return localStorage.getItem(SITE_STORAGE_KEY);
}

/** Reads the persisted site id without re-parsing the URL — null if none stored/found yet. */
export function getStoredSiteId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SITE_STORAGE_KEY);
}

// Access point MAC + SSID from the same redirect — not used to filter
// anything yet, captured now (while the URL is already being parsed for
// the site id) for future per-AP analytics rather than a second pass later.
export function getApMac() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const ap = params.get('ap');
  if (ap) {
    const value = ap.toLowerCase();
    localStorage.setItem(AP_STORAGE_KEY, value);
    return value;
  }
  return localStorage.getItem(AP_STORAGE_KEY);
}

export function getSsid() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const ssid = params.get('ssid');
  if (ssid) {
    localStorage.setItem(SSID_STORAGE_KEY, ssid);
    return ssid;
  }
  return localStorage.getItem(SSID_STORAGE_KEY);
}
