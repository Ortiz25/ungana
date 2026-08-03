// Router-side authorisation. Talks to a UniFi controller to create a
// voucher and authorise a client MAC — the step that actually grants
// internet access once a session is marked paid. Adapted from the
// reference example-backend.js; swap this module out if you're fronting a
// different controller (Mikrotik, RADIUS, etc.) — nothing else in the
// backend depends on UniFi specifically.
import axios from "axios";
import https from "https";
import { UNIFI_URL, UNIFI_SITE, UNIFI_USERNAME, UNIFI_PASSWORD } from "../config.js";

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

async function login() {
  try {
    const response = await axios.post(
      `${UNIFI_URL}/api/login`,
      { username: UNIFI_USERNAME, password: UNIFI_PASSWORD },
      { headers: { "Content-Type": "application/json" }, httpsAgent: insecureAgent, withCredentials: true }
    );

    if (response.data?.meta?.rc === "ok") {
      const cookies = response.headers["set-cookie"];
      return Array.isArray(cookies) ? cookies.join("; ") : cookies;
    }
    console.error("❌ UniFi login failed:", response.data);
    return null;
  } catch (error) {
    console.error("❌ UniFi login error:", error.response?.data || error.message);
    return null;
  }
}

async function getVouchers(cookie) {
  const response = await axios.get(`${UNIFI_URL}/api/s/${UNIFI_SITE}/stat/voucher`, {
    headers: { Cookie: cookie },
    httpsAgent: insecureAgent,
  });
  return response.data.data || [];
}

async function createVoucher(cookie, { duration, expire_number, expire_unit, data }) {
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

  const response = await axios.post(`${UNIFI_URL}/api/s/${UNIFI_SITE}/cmd/hotspot`, payload, {
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    httpsAgent: insecureAgent,
  });

  if (response.data?.meta?.rc !== "ok") return null;

  const vouchers = await getVouchers(cookie);
  return vouchers.filter((v) => v.note === payload.note).sort((a, b) => b.create_time - a.create_time)[0];
}

/**
 * Create a voucher and authorise `clientMac` for the given duration/data
 * allowance. Returns true on success, false if the controller is
 * unreachable or rejects the request (caller should retry later).
 */
export async function authorizeClient(clientMac, { duration, data, expire_number, expire_unit }) {
  if (!UNIFI_URL) {
    console.warn("⚠️  UNIFI_URL not configured — skipping router authorisation (session still recorded in DB)");
    return true;
  }

  const cookie = await login();
  if (!cookie) return false;

  const voucher = await createVoucher(cookie, { duration, data, expire_number, expire_unit });
  if (!voucher) return false;

  const payload = { cmd: "authorize-guest", mac: clientMac.toLowerCase(), voucher: voucher.code };
  if (voucher.qos_usage_quota) {
    payload.bytes = +voucher.qos_usage_quota * 1;
    payload.minutes = 0;
  } else if (voucher.duration) {
    payload.minutes = voucher.duration;
  }

  try {
    const response = await axios.post(`${UNIFI_URL}/api/s/${UNIFI_SITE}/cmd/stamgr`, payload, {
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      httpsAgent: insecureAgent,
    });
    return response.data?.meta?.rc === "ok";
  } catch (error) {
    console.error("❌ UniFi authorisation error:", error.response?.data || error.message);
    return false;
  }
}
