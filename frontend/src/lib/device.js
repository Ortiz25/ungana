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

export function getClientMac() {
  if (typeof window === 'undefined') return '00:00:00:00:00:00';

  const params = new URLSearchParams(window.location.search);
  for (const name of ROUTER_PARAM_NAMES) {
    const value = params.get(name);
    if (value) return value.toLowerCase();
  }

  let mac = localStorage.getItem(MAC_STORAGE_KEY);
  if (!mac) {
    mac = randomMac();
    localStorage.setItem(MAC_STORAGE_KEY, mac);
  }
  return mac;
}
