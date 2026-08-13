// Router-side authorisation against a UniFi OS console (UDM, UDM-Pro, UDR,
// Cloud Key Gen2+ — anything running the Network application under UniFi
// OS), NOT the classic standalone software controller. Key differences
// from the classic API this module originally targeted:
//   - Login is POST /api/auth/login (not /api/login), on the console's
//     standard HTTPS port — no :8443 suffix.
//   - Every Network-application endpoint is proxied under /proxy/network,
//     e.g. /proxy/network/api/s/<site>/stat/voucher instead of
//     /api/s/<site>/stat/voucher.
//   - UniFi OS requires a CSRF token (from the login response's
//     `x-csrf-token` header) echoed back as an `X-CSRF-Token` header on
//     every request — the session cookie alone is rejected.
//   - The admin account used for UNIFI_USERNAME/UNIFI_PASSWORD must be a
//     "local access only" console user — accounts tied to a Ubiquiti cloud
//     (SSO) identity cannot authenticate through this local API.
// Swap this module out if you're fronting a different controller (classic
// UniFi controller, Mikrotik, RADIUS, etc.) — nothing else in the backend
// depends on UniFi OS specifically.
import axios from "axios";
import https from "https";
import { UNIFI_URL, UNIFI_SITE, UNIFI_USERNAME, UNIFI_PASSWORD } from "../config.js";

const insecureAgent = new https.Agent({ rejectUnauthorized: false }); // local consoles use self-signed certs
const NETWORK_API = "/proxy/network";

/** Logs in and returns { cookie, csrfToken } — both required on every subsequent call. */
export async function login() {
  try {
    const response = await axios.post(
      `${UNIFI_URL}/api/auth/login`,
      { username: UNIFI_USERNAME, password: UNIFI_PASSWORD },
      { headers: { "Content-Type": "application/json" }, httpsAgent: insecureAgent, withCredentials: true }
    );
   

    const cookies = response.headers["set-cookie"];
    const cookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    const csrfToken = response.headers["x-csrf-token"];

    if (!cookie) {
      console.error("❌ UniFi OS login failed: no session cookie returned");
      return null;
    }
    return { cookie, csrfToken };
  } catch (error) {
    console.error("❌ UniFi OS login error:", error.response?.data || error.message);
    return null;
  }
}

export const getSites = async () => {
  try {
    const session = await login();
    if (!session) {
      console.error("❌ Cannot fetch sites: login failed");
      return null;
    }

    const response = await axios.get(`${UNIFI_URL}${NETWORK_API}/api/self/sites`, {
      headers: authHeaders(session),
      httpsAgent: insecureAgent,
      withCredentials: true,
    });

    if (response.data?.meta?.rc === "ok") {
      console.log("✅ Fetched UniFi Sites!", response.data.data);
      return response.data.data.map((site) => ({
        id: site._id,
        name: site.name,
        desc: site.desc,
      }));
    }

    console.error("❌ Failed to fetch sites:", response.data);
    return null;
  } catch (error) {
    console.error("❌ UniFi Sites Error:", error.response?.data || error.message);
    return null;
  }
};



// UniFi's `device.state` codes, condensed to what's actually useful to show
// a coordinator: 1 = connected is the only genuinely "healthy" value; 0 =
// disconnected is unambiguously offline; everything else (pending adoption,
// upgrading, provisioning, heartbeat-missed, isolated, etc.) is some kind of
// in-between/problem state, which is what "degraded" means here — UniFi
// doesn't expose a single "degraded" flag, this is our own bucket over its
// real state codes, not a fabricated metric.
function classifyApState(state) {
  if (state === 1) return "online";
  if (state === 0) return "offline";
  return "degraded";
}

/**
 * AP status across every UniFi site — per-site breakdown (each access
 * point's name and online/degraded/offline state) plus totals across all
 * sites. One login, then one sites call and one device call per site (all
 * in parallel) — no caching or polling: this answers "is the network
 * broadly OK right now", not a telemetry system. Returns null if UNIFI_URL
 * isn't configured or the console is unreachable — callers should treat
 * that as "nothing to show", not an error to surface loudly.
 */
export async function getNetworkSummary() {
  if (!UNIFI_URL) return null;

  try {
    const session = await login();
    if (!session) return null;

    const sitesResponse = await axios.get(`${UNIFI_URL}${NETWORK_API}/api/self/sites`, {
      headers: authHeaders(session),
      httpsAgent: insecureAgent,
    });
    const siteRows = sitesResponse.data?.data ?? [];
    if (siteRows.length === 0) return null;

    // `/api/s/<x>/...` takes the site's short `name` slug (e.g. "default",
    // "99kv3joz") — its `_id` (the Mongo ObjectId) returns
    // api.err.NoSiteContext. Same field `listUnifiSiteOptions()` in
    // services/sites.js already uses for `sites.id` — matching that
    // convention here too, not just what happens to work.
    const deviceResponses = await Promise.all(
      siteRows.map((s) =>
        axios
          .get(`${UNIFI_URL}${NETWORK_API}/api/s/${s.name}/stat/device`, {
            headers: authHeaders(session),
            httpsAgent: insecureAgent,
          })
          .then((r) => r.data?.data ?? [])
          .catch(() => []) // one site being unreachable shouldn't blank out the rest
      )
    );

    const sites = siteRows.map((s, i) => {
      const devices = deviceResponses[i];
      // Only access points, not switches/gateways — `type` is a reasonably
      // stable UniFi field, but if it doesn't match anything on this
      // console's version (rather than genuinely having zero APs), showing
      // every adopted device is a better fallback than showing none.
      const uaps = devices.filter((d) => d.type === "uap");
      const accessPoints = (uaps.length > 0 ? uaps : devices).map((d) => ({
        id: d._id,
        name: d.name || d.model || d.mac,
        // Client-count field name has drifted across UniFi OS/controller
        // versions — try the known shapes, default to 0 rather than guess
        // wrong on a version this hasn't been checked against.
        clients: d.num_sta ?? d["user-num_sta"] ?? 0,
        status: classifyApState(d.state),
      }));

      const onlineAPs = accessPoints.filter((d) => d.status === "online").length;
      const degradedAPs = accessPoints.filter((d) => d.status === "degraded").length;
      const totalClients = accessPoints.reduce((sum, d) => sum + d.clients, 0);

      return {
        site: { id: s.name, name: s.desc || s.name },
        totalAPs: accessPoints.length,
        onlineAPs,
        degradedAPs,
        offlineAPs: accessPoints.length - onlineAPs - degradedAPs,
        totalClients,
        accessPoints,
      };
    });

    const totals = sites.reduce(
      (acc, s) => ({
        totalAPs: acc.totalAPs + s.totalAPs,
        onlineAPs: acc.onlineAPs + s.onlineAPs,
        degradedAPs: acc.degradedAPs + s.degradedAPs,
        offlineAPs: acc.offlineAPs + s.offlineAPs,
        totalClients: acc.totalClients + s.totalClients,
      }),
      { totalAPs: 0, onlineAPs: 0, degradedAPs: 0, offlineAPs: 0, totalClients: 0 }
    );

    return { totals, sites };
  } catch (error) {
    console.error("❌ UniFi network summary error:", error.response?.data || error.message);
    return null;
  }
}

function authHeaders(session, extra = {}) {
  return {
    Cookie: session.cookie,
    ...(session.csrfToken ? { "X-CSRF-Token": session.csrfToken } : {}),
    ...extra,
  };
}

async function getVouchers(session, site = UNIFI_SITE) {
  const response = await axios.get(`${UNIFI_URL}${NETWORK_API}/api/s/${site}/stat/voucher`, {
    headers: authHeaders(session),
    httpsAgent: insecureAgent,
  });
  return response.data.data || [];
}

async function createVoucher(session, { duration, expire_number, expire_unit, data, site = UNIFI_SITE }) {
  const payload = data
    ? {
        cmd: "create-voucher",
        n: 1,
        quota: 1,
        note: "Ungana Data Auth",
        bytes: data,
        expire: 525600,
        expire_number: 365,
        expire_unit: 1440,
        for_hotspot: true,
      }
    : {
        cmd: "create-voucher",
        expire: duration,
        n: 1,
        quota: 1,
        note: "Ungana Time Auth",
        for_hotspot: true,
        expire_number,
        expire_unit,
      };

  const response = await axios.post(`${UNIFI_URL}${NETWORK_API}/api/s/${site}/cmd/hotspot`, payload, {
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    httpsAgent: insecureAgent,
  });

  if (response.data?.meta?.rc !== "ok") return null;

  const vouchers = await getVouchers(session, site);
  return vouchers.filter((v) => v.note === payload.note).sort((a, b) => b.create_time - a.create_time)[0];
}

/**
 * Create a voucher and authorise `clientMac` for the given duration/data
 * allowance. Returns true on success, false if the console is unreachable
 * or rejects the request (caller should retry later).
 * `site` is the UniFi site id to authorise on — defaults to the single
 * UNIFI_SITE env var when omitted, so callers that predate multi-site (or
 * a session with no site_id recorded) keep working unchanged.
 */
export async function authorizeClient(clientMac, { duration, data, expire_number, expire_unit, site = UNIFI_SITE }) {
  if (!UNIFI_URL) {
    console.warn("⚠️  UNIFI_URL not configured — skipping router authorisation (session still recorded in DB)");
    return true;
  }

  const session = await login();
  if (!session) return false;

  const voucher = await createVoucher(session, { duration, data, expire_number, expire_unit, site });
  if (!voucher) return false;

  const payload = { cmd: "authorize-guest", mac: clientMac.toLowerCase(), voucher: voucher.code };
  if (voucher.qos_usage_quota) {
    payload.bytes = +voucher.qos_usage_quota * 1;
    payload.minutes = 0;
  } else if (voucher.duration) {
    payload.minutes = voucher.duration;
  }

  try {
    const response = await axios.post(`${UNIFI_URL}${NETWORK_API}/api/s/${site}/cmd/stamgr`, payload, {
      headers: authHeaders(session, { "Content-Type": "application/json" }),
      httpsAgent: insecureAgent,
    });
    return response.data?.meta?.rc === "ok";
  } catch (error) {
    console.error("❌ UniFi OS authorisation error:", error.response?.data || error.message);
    return false;
  }
}
