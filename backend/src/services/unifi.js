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

const getSites = async () => {
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



function authHeaders(session, extra = {}) {
  return {
    Cookie: session.cookie,
    ...(session.csrfToken ? { "X-CSRF-Token": session.csrfToken } : {}),
    ...extra,
  };
}

async function getVouchers(session) {
  const response = await axios.get(`${UNIFI_URL}${NETWORK_API}/api/s/${UNIFI_SITE}/stat/voucher`, {
    headers: authHeaders(session),
    httpsAgent: insecureAgent,
  });
  return response.data.data || [];
}

async function createVoucher(session, { duration, expire_number, expire_unit, data }) {
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

  const response = await axios.post(`${UNIFI_URL}${NETWORK_API}/api/s/${UNIFI_SITE}/cmd/hotspot`, payload, {
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    httpsAgent: insecureAgent,
  });

  if (response.data?.meta?.rc !== "ok") return null;

  const vouchers = await getVouchers(session);
  return vouchers.filter((v) => v.note === payload.note).sort((a, b) => b.create_time - a.create_time)[0];
}

/**
 * Create a voucher and authorise `clientMac` for the given duration/data
 * allowance. Returns true on success, false if the console is unreachable
 * or rejects the request (caller should retry later).
 */
export async function authorizeClient(clientMac, { duration, data, expire_number, expire_unit }) {
  if (!UNIFI_URL) {
    console.warn("⚠️  UNIFI_URL not configured — skipping router authorisation (session still recorded in DB)");
    return true;
  }

  const session = await login();
  if (!session) return false;

  const voucher = await createVoucher(session, { duration, data, expire_number, expire_unit });
  if (!voucher) return false;

  const payload = { cmd: "authorize-guest", mac: clientMac.toLowerCase(), voucher: voucher.code };
  if (voucher.qos_usage_quota) {
    payload.bytes = +voucher.qos_usage_quota * 1;
    payload.minutes = 0;
  } else if (voucher.duration) {
    payload.minutes = voucher.duration;
  }

  try {
    const response = await axios.post(`${UNIFI_URL}${NETWORK_API}/api/s/${UNIFI_SITE}/cmd/stamgr`, payload, {
      headers: authHeaders(session, { "Content-Type": "application/json" }),
      httpsAgent: insecureAgent,
    });
    return response.data?.meta?.rc === "ok";
  } catch (error) {
    console.error("❌ UniFi OS authorisation error:", error.response?.data || error.message);
    return false;
  }
}
