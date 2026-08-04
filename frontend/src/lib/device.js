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
