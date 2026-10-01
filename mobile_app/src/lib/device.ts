// Device identity for the mobile app — the AsyncStorage/deep-link
// counterpart to frontend/src/lib/device.js's localStorage/URL-param
// reading. Deliberately NOT a 1:1 port: the web version falls back to a
// randomly-generated fake MAC when it finds neither a URL param nor a
// stored one (fine for a browser context, since any browser tab can
// plausibly be "a device"). This app never does that — see the plan doc's
// "MAC limitation" section. A phone that has never received a deep link
// from the web captive-portal flow, and has never recovered a session by
// username, genuinely has no identity yet, and the router should send it
// to the onboarding/recovery screen rather than pretend otherwise.
//
// AsyncStorage is async, unlike localStorage, so this can't offer the same
// synchronous getClientMac()/getSiteId() the web version does. Call
// initDeviceIdentity() once at app startup (see app/_layout.tsx) and await
// it before rendering the router; every getter below is synchronous after
// that, reading from an in-memory cache kept in sync with AsyncStorage by
// every setter in this file.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";

const MAC_KEY = "ungana_client_mac";
const SITE_KEY = "ungana_site_id";
const USERNAME_KEY = "ungana_username";

let cachedMac: string | null = null;
let cachedSite: string | null = null;
let cachedUsername: string | null = null;
let macIsFreshThisLaunch = false;
let initialized = false;

type DeepLinkPayload = { mac?: string; site?: string; username?: string };

/**
 * Parses `ungana://activate?mac=...&site=...&username=...` (or any other
 * path on the same scheme carrying these params) — the mobile equivalent
 * of device.js reading `id`/`mac`/`client_mac` and `site`/`s` off
 * `window.location`. See ActiveScreen.svelte's "Continue in the app" CTA
 * on the web side for what builds this URL.
 */
function parseDeepLink(url: string | null | undefined): DeepLinkPayload {
  if (!url) return {};
  try {
    const { queryParams } = Linking.parse(url);
    const mac = typeof queryParams?.mac === "string" ? queryParams.mac.toLowerCase() : undefined;
    const site = typeof queryParams?.site === "string" ? queryParams.site : undefined;
    const username = typeof queryParams?.username === "string" ? queryParams.username : undefined;
    return { mac, site, username };
  } catch {
    return {};
  }
}

async function persist(payload: DeepLinkPayload): Promise<void> {
  const writes: Promise<void>[] = [];
  if (payload.mac) {
    cachedMac = payload.mac;
    writes.push(AsyncStorage.setItem(MAC_KEY, payload.mac));
  }
  if (payload.site) {
    cachedSite = payload.site;
    writes.push(AsyncStorage.setItem(SITE_KEY, payload.site));
  }
  if (payload.username) {
    cachedUsername = payload.username;
    writes.push(AsyncStorage.setItem(USERNAME_KEY, payload.username));
  }
  await Promise.all(writes);
}

/**
 * Resolves identity once at app startup. A fresh deep link (the URL the OS
 * launched the app with, if any) always wins over whatever was previously
 * stored, then is persisted immediately so it survives the next cold
 * start too — same "URL param always wins, then gets cached" convention
 * as device.js.
 */
export async function initDeviceIdentity(initialUrl: string | null): Promise<void> {
  const fromLink = parseDeepLink(initialUrl);
  const [storedMac, storedSite, storedUsername] = await Promise.all([
    AsyncStorage.getItem(MAC_KEY),
    AsyncStorage.getItem(SITE_KEY),
    AsyncStorage.getItem(USERNAME_KEY),
  ]);

  cachedMac = fromLink.mac ?? storedMac;
  cachedSite = fromLink.site ?? storedSite;
  cachedUsername = fromLink.username ?? storedUsername;
  // Mirrors +page.svelte's hasRouterMac/hasStoredMac distinction: a mac
  // that just arrived via deep link is provably this device, right now
  // (the web app only sends that link from an already-authorized
  // session) — a merely-cached one from a previous launch isn't, the same
  // way a cached-but-unconfirmed browser mac isn't trusted on the web
  // side either. AppRouter uses this to decide whether "no session found
  // for this mac" means "genuinely new" (packages) or "not sure this is
  // really them" (check-session).
  macIsFreshThisLaunch = !!fromLink.mac;
  initialized = true;

  if (fromLink.mac || fromLink.site || fromLink.username) await persist(fromLink);
}

/** A deep link received while the app is already running (`Linking.addEventListener('url', ...)`) — same precedence as the cold-start path above. */
export async function applyDeepLink(url: string): Promise<void> {
  await persist(parseDeepLink(url));
}

/**
 * Manual recovery (CheckSessionScreen's "I have an account" path) — call
 * once GET /session/by-username/:username resolves, so every later API
 * call in this session acts as the real device that session belongs to.
 * Requires the sessionStatusPayload backend fix described in the plan doc
 * (adds `clientMac` to that response) — until that ships, `mac` will be
 * undefined here and only the read-only balance/countdown can be shown,
 * not "buy more time" for that recovered device.
 */
export async function setRecoveredIdentity(payload: DeepLinkPayload): Promise<void> {
  await persist(payload);
}

/** Manual "Enter site code" onboarding path. */
export async function setSiteId(site: string): Promise<void> {
  await persist({ site });
}

export async function clearIdentity(): Promise<void> {
  cachedMac = null;
  cachedSite = null;
  cachedUsername = null;
  await AsyncStorage.multiRemove([MAC_KEY, SITE_KEY, USERNAME_KEY]);
}

/** null = this device genuinely has no known identity yet — route to onboarding, don't invent one. */
export function getClientMac(): string | null {
  if (!initialized) throw new Error("device identity not initialized — call initDeviceIdentity() first");
  return cachedMac;
}

export function getSiteId(): string | null {
  if (!initialized) throw new Error("device identity not initialized — call initDeviceIdentity() first");
  return cachedSite;
}

export function getStoredUsername(): string | null {
  return cachedUsername;
}

export function hasKnownIdentity(): boolean {
  return !!cachedMac;
}

/** True only for the launch that actually received the mac via deep link — see initDeviceIdentity's comment. */
export function isMacFreshThisLaunch(): boolean {
  return macIsFreshThisLaunch;
}
