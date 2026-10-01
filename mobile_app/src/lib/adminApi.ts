// Ported from frontend/src/lib/api.js's admin* exports. Phase 1 covered
// login + Coordinators + Activators; Phase 2 adds Sites + Packages.
// Kept in its own file rather than folded into api.ts, matching that file's
// own header comment ("adminX/activatorX/coordinatorX endpoints come in a
// later phase") — this *is* that later phase, for the admin slice of it.
import { request, type ApiResult, BACKEND_ORIGIN } from "@/lib/api";

function authed(token: string): { headers: Record<string, string> } {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export type AdminInfo = { id: number; username: string; role: "admin" | "super_admin" };

/**
 * POST /api/admin/login — Body: { username, password }. Longer timeout than
 * the default: the backend verifies the password with bcryptjs (pure-JS,
 * no native bindings), which routinely takes several seconds per compare —
 * well past the standard 5s, which was aborting the request before a
 * correct password could ever come back as a "success".
 */
export function adminLogin(username: string, password: string): Promise<ApiResult<{ success: boolean; token: string; admin: AdminInfo; message?: string }>> {
  return request("/admin/login", { method: "POST", body: JSON.stringify({ username, password }), timeoutMs: 15000 });
}

export type Coordinator = {
  id: number;
  name: string;
  phone: string;
  territory: string | null;
  status: "active" | "suspended";
  created_at: string;
  activator_count: number;
  paid_sessions: number;
  gross_kes: number;
  commission_kes: number;
};

/** GET /api/admin/coordinators — every coordinator with a performance rollup of their activators. */
export function adminGetCoordinators(token: string): Promise<ApiResult<{ coordinators: Coordinator[]; message?: string }>> {
  return request("/admin/coordinators", authed(token));
}

/** POST /api/admin/coordinators — Body: { name, phone, pin, territory? } */
export function adminCreateCoordinator(
  token: string,
  body: { name: string; phone: string; pin: string; territory?: string }
): Promise<ApiResult<{ success: boolean; coordinator?: Coordinator; message?: string }>> {
  return request("/admin/coordinators", { method: "POST", body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/admin/coordinators/:id — partial update, including status suspend/activate. */
export function adminUpdateCoordinator(
  token: string,
  id: number,
  body: Partial<{ name: string; territory: string | null; status: "active" | "suspended"; pin: string }>
): Promise<ApiResult<{ success: boolean; coordinator?: Coordinator; message?: string }>> {
  return request(`/admin/coordinators/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body), ...authed(token) });
}

export type Activator = {
  id: number;
  code: string;
  name: string;
  phone: string;
  territory: string | null;
  mpesa_number: string | null;
  commission_rate: number;
  status: "active" | "suspended";
  coordinator_id: number | null;
  coordinator_name: string | null;
  created_at: string;
  paid_sessions: number;
  gross_kes: number;
  commission_kes: number;
};

/** GET /api/admin/activators — every activator with a performance rollup. */
export function adminGetActivators(token: string): Promise<ApiResult<{ activators: Activator[]; message?: string }>> {
  return request("/admin/activators", authed(token));
}

/** POST /api/admin/activators — Body: { code, name, phone, pin, territory?, mpesaNumber?, commissionRate?, coordinatorId? } */
export function adminCreateActivator(
  token: string,
  body: { code: string; name: string; phone: string; pin: string; territory?: string; mpesaNumber?: string; commissionRate?: number; coordinatorId?: number }
): Promise<ApiResult<{ success: boolean; activator?: Activator; message?: string }>> {
  return request("/admin/activators", { method: "POST", body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/admin/activators/:id — partial update, including status suspend/activate. */
export function adminUpdateActivator(
  token: string,
  id: number,
  body: Partial<{ name: string; territory: string | null; mpesaNumber: string | null; commissionRate: number; coordinatorId: number | null; status: "active" | "suspended"; pin: string }>
): Promise<ApiResult<{ success: boolean; activator?: Activator; message?: string }>> {
  return request(`/admin/activators/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body), ...authed(token) });
}

export type Site = {
  id: string;
  name: string;
  mode: "pay_only" | "earn_only" | "both";
  status: "active" | "suspended";
  btc_enabled: boolean;
  vertical: "general" | "institution" | "community";
  created_at: string;
  updated_at: string;
};

export type UnifiSiteOption = { id: string; name: string };

/** GET /api/admin/sites — every site, including suspended. */
export function adminGetSites(token: string): Promise<ApiResult<{ sites: Site[]; message?: string }>> {
  return request("/admin/sites", authed(token));
}

/** GET /api/admin/sites/unifi-options — real sites known to the UniFi controller, for the "Add Site" picker. [] if unreachable. */
export function adminGetUnifiSiteOptions(token: string): Promise<ApiResult<{ options: UnifiSiteOption[] }>> {
  return request("/admin/sites/unifi-options", authed(token));
}

/** POST /api/admin/sites — Body: { id, name, mode?, btcEnabled?, vertical? }. */
export function adminCreateSite(
  token: string,
  body: { id: string; name: string; mode?: Site["mode"]; btcEnabled?: boolean; vertical?: Site["vertical"] }
): Promise<ApiResult<{ success: boolean; site?: Site; message?: string }>> {
  return request("/admin/sites", { method: "POST", body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/admin/sites/:id — partial update: name, mode, status, btcEnabled, vertical. */
export function adminUpdateSite(
  token: string,
  id: string,
  body: Partial<{ name: string; mode: Site["mode"]; status: Site["status"]; btcEnabled: boolean; vertical: Site["vertical"] }>
): Promise<ApiResult<{ success: boolean; site?: Site; message?: string }>> {
  return request(`/admin/sites/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body), ...authed(token) });
}

/** DELETE /api/admin/sites/:id — hard delete. */
export function adminDeleteSite(token: string, id: string): Promise<ApiResult<{ success: boolean; site?: Site; message?: string }>> {
  return request(`/admin/sites/${encodeURIComponent(id)}`, { method: "DELETE", ...authed(token) });
}

export type Package = {
  id: string;
  label: string;
  price_kes: number;
  duration_secs: number;
  is_active: boolean;
  badge: string | null;
  is_featured: boolean;
  created_at: string;
  site_ids: string[];
};

/** GET /api/admin/packages — every package (including inactive), excludes the internal 'earned' row. */
export function adminGetPackages(token: string): Promise<ApiResult<{ packages: Package[]; message?: string }>> {
  return request("/admin/packages", authed(token));
}

/** POST /api/admin/packages — Body: { id, label, priceKes, durationSecs, badge?, isActive?, siteIds? }. */
export function adminCreatePackage(
  token: string,
  body: { id: string; label: string; priceKes: number; durationSecs: number; badge?: string | null; isActive?: boolean; siteIds?: string[] }
): Promise<ApiResult<{ success: boolean; package?: Package; message?: string }>> {
  return request("/admin/packages", { method: "POST", body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/admin/packages/:id — partial update: label, priceKes, durationSecs, badge, isActive, siteIds. */
export function adminUpdatePackage(
  token: string,
  id: string,
  body: Partial<{ label: string; priceKes: number; durationSecs: number; badge: string | null; isActive: boolean; siteIds: string[] }>
): Promise<ApiResult<{ success: boolean; package?: Package; message?: string }>> {
  return request(`/admin/packages/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/admin/packages/:id/feature — Body: { featured }. At most one package is ever featured. */
export function adminSetPackageFeatured(token: string, id: string, featured: boolean): Promise<ApiResult<{ success: boolean; package?: Package; message?: string }>> {
  return request(`/admin/packages/${encodeURIComponent(id)}/feature`, { method: "PATCH", body: JSON.stringify({ featured }), ...authed(token) });
}

/** DELETE /api/admin/packages/:id — hard delete; 409 if the package has purchase history (deactivate instead). */
export function adminDeletePackage(token: string, id: string): Promise<ApiResult<{ success: boolean; package?: Package; message?: string }>> {
  return request(`/admin/packages/${encodeURIComponent(id)}`, { method: "DELETE", ...authed(token) });
}

// ── File uploads (Content / Campus posts / Community posts) ────────────────
// One multipart endpoint per section, all identical in shape — image/video
// (PDF too for campus attachments), re-encoded server-side if video, so this
// can take noticeably longer than a plain save for a multi-minute clip (same
// 4-minute timeout the web client uses for these three).
export type AdminUploadEndpoint = "/admin/content/upload" | "/admin/campus-posts/upload" | "/admin/community-posts/upload";

export async function adminUploadFile(
  token: string,
  endpoint: AdminUploadEndpoint,
  file: { uri: string; name: string; mimeType: string }
): Promise<ApiResult<{ success: boolean; url?: string; message?: string }>> {
  const formData = new FormData();
  // React Native's fetch FormData accepts this {uri,name,type} shape for a
  // local file picked via expo-image-picker — it isn't a real Blob, but RN's
  // networking layer knows how to stream it from disk as a multipart part.
  formData.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  const result = await request<{ success: boolean; url?: string; message?: string }>(endpoint, { method: "POST", body: formData, timeoutMs: 240000, ...authed(token) });
  if (result.ok && result.data?.url) {
    return { ...result, data: { ...result.data, url: `${BACKEND_ORIGIN}${result.data.url}` } };
  }
  return result;
}

export type ContentSection = "hero" | "whats_new" | "survey" | "news" | "watch_earn";
export type ViewFrequency = "once" | "daily" | "weekly" | "monthly" | "session";
export type SurveyQuestion = { question: string; answers: string[] };

export type ContentItem = {
  id: number;
  type: "video" | "article" | "survey" | "lesson";
  section: ContentSection;
  title: string;
  category: string | null;
  duration_label: string | null;
  earn_secs: number;
  min_watch_secs: number;
  img_url: string | null;
  body_url: string | null;
  survey_questions: SurveyQuestion[] | null;
  view_frequency: ViewFrequency;
  impressions: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  site_ids: string[];
};

export type ContentBody = {
  type: ContentItem["type"];
  section?: ContentSection;
  viewFrequency?: ViewFrequency;
  title: string;
  category?: string;
  durationLabel?: string;
  earnSecs: number;
  minWatchSecs?: number;
  imgUrl?: string;
  bodyUrl?: string;
  surveyQuestions?: SurveyQuestion[];
  siteIds?: string[];
};

/** GET /api/admin/content — every item, including deactivated ones. */
export function adminGetContent(token: string): Promise<ApiResult<{ items: ContentItem[]; message?: string }>> {
  return request("/admin/content", authed(token));
}

/** POST /api/admin/content */
export function adminCreateContent(token: string, body: ContentBody): Promise<ApiResult<{ success: boolean; item?: ContentItem; message?: string }>> {
  return request("/admin/content", { method: "POST", body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/admin/content/:id — partial update; any field from ContentBody, plus isActive. */
export function adminUpdateContent(token: string, id: number, body: Partial<ContentBody> & { isActive?: boolean }): Promise<ApiResult<{ success: boolean; item?: ContentItem; message?: string }>> {
  return request(`/admin/content/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body), ...authed(token) });
}

/** DELETE /api/admin/content/:id — deactivates rather than hard-deletes. */
export function adminDeleteContent(token: string, id: number): Promise<ApiResult<{ success: boolean; item?: ContentItem; message?: string }>> {
  return request(`/admin/content/${encodeURIComponent(id)}`, { method: "DELETE", ...authed(token) });
}

export type PostPriority = "normal" | "important" | "urgent";

export type CampusPost = {
  id: number;
  site_id: string;
  type: "notice" | "release" | "event" | "timetable" | "resource" | "poll";
  title: string;
  body: string | null;
  category: string | null;
  priority: PostPriority;
  attachment_url: string | null;
  event_starts_at: string | null;
  event_ends_at: string | null;
  location: string | null;
  metadata: { options?: string[] };
  is_pinned: boolean;
  is_active: boolean;
  sort_order: number;
  images: string[];
  clicks: number;
  read_count: number;
  published_at: string;
  created_at: string;
};

export type CampusPostBody = {
  siteId: string;
  type: CampusPost["type"];
  title: string;
  body?: string;
  category?: string;
  priority?: PostPriority;
  attachmentUrl?: string;
  eventStartsAt?: string;
  eventEndsAt?: string;
  location?: string;
  metadata?: { options?: string[] };
  isPinned?: boolean;
  images?: string[];
};

/** GET /api/admin/campus-posts?site=<id> — every post, including deactivated ones. site is optional. */
export function adminGetCampusPosts(token: string, site?: string): Promise<ApiResult<{ posts: CampusPost[]; message?: string }>> {
  return request(`/admin/campus-posts${site ? `?site=${encodeURIComponent(site)}` : ""}`, authed(token));
}

/** POST /api/admin/campus-posts */
export function adminCreateCampusPost(token: string, body: CampusPostBody): Promise<ApiResult<{ success: boolean; post?: CampusPost; message?: string }>> {
  return request("/admin/campus-posts", { method: "POST", body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/admin/campus-posts/:id — partial update; any field from CampusPostBody, plus isActive. */
export function adminUpdateCampusPost(token: string, id: number, body: Partial<CampusPostBody> & { isActive?: boolean }): Promise<ApiResult<{ success: boolean; post?: CampusPost; message?: string }>> {
  return request(`/admin/campus-posts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body), ...authed(token) });
}

/** DELETE /api/admin/campus-posts/:id — deactivates rather than hard-deletes. */
export function adminDeleteCampusPost(token: string, id: number): Promise<ApiResult<{ success: boolean; post?: CampusPost; message?: string }>> {
  return request(`/admin/campus-posts/${encodeURIComponent(id)}`, { method: "DELETE", ...authed(token) });
}

export type CommunityPost = {
  id: number;
  site_id: string;
  type: "announcement" | "event" | "marketplace" | "service" | "poll";
  title: string;
  body: string | null;
  category: string | null;
  priority: PostPriority;
  attachment_url: string | null;
  price_kes: number | null;
  event_starts_at: string | null;
  event_ends_at: string | null;
  location: string | null;
  metadata: { options?: string[]; condition?: string; contactPhone?: string };
  is_pinned: boolean;
  is_active: boolean;
  sort_order: number;
  images: string[];
  clicks: number;
  read_count: number;
  published_at: string;
  created_at: string;
};

export type CommunityPostBody = {
  siteId: string;
  type: CommunityPost["type"];
  title: string;
  body?: string;
  category?: string;
  priority?: PostPriority;
  attachmentUrl?: string;
  priceKes?: number;
  eventStartsAt?: string;
  eventEndsAt?: string;
  location?: string;
  metadata?: { options?: string[]; condition?: string; contactPhone?: string };
  isPinned?: boolean;
  images?: string[];
};

/** GET /api/admin/community-posts?site=<id> — every post, including deactivated ones. site is optional. */
export function adminGetCommunityPosts(token: string, site?: string): Promise<ApiResult<{ posts: CommunityPost[]; message?: string }>> {
  return request(`/admin/community-posts${site ? `?site=${encodeURIComponent(site)}` : ""}`, authed(token));
}

/** POST /api/admin/community-posts */
export function adminCreateCommunityPost(token: string, body: CommunityPostBody): Promise<ApiResult<{ success: boolean; post?: CommunityPost; message?: string }>> {
  return request("/admin/community-posts", { method: "POST", body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/admin/community-posts/:id — partial update; any field from CommunityPostBody, plus isActive. */
export function adminUpdateCommunityPost(
  token: string,
  id: number,
  body: Partial<CommunityPostBody> & { isActive?: boolean }
): Promise<ApiResult<{ success: boolean; post?: CommunityPost; message?: string }>> {
  return request(`/admin/community-posts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body), ...authed(token) });
}

/** DELETE /api/admin/community-posts/:id — deactivates rather than hard-deletes. */
export function adminDeleteCommunityPost(token: string, id: number): Promise<ApiResult<{ success: boolean; post?: CommunityPost; message?: string }>> {
  return request(`/admin/community-posts/${encodeURIComponent(id)}`, { method: "DELETE", ...authed(token) });
}

// ── Analytics ────────────────────────────────────────────────────────────
// Covers the summary stat cards + content overview + per-item drill-down
// only. The web dashboard's 14-day purchases-by-site/by-package timeline
// charts (MultiLineChartMini/BarChartMini, SVG-based) and their "view more"
// granularity drill-down are deliberately not ported yet — a real charting
// dependency for a phone screen is a bigger decision than the rest of this
// phase, left for a later pass.
export type AdminAnalytics = {
  earned: {
    totalImpressions: number;
    totalCompletions: number;
    uniqueClientsEngaged: number;
    totalEarnedSecs: number;
    totalClaimedSecs: number;
    sessionsGrantedViaEarning: number;
    activeSessionsNow: number;
    contentOverview: { id: number; title: string; type: string; isActive: boolean; impressions: number; completions: number }[];
  };
  purchased: {
    totalPaidSessions: number;
    totalRevenueKes: number;
    totalCommissionKes: number;
    activeSessionsNow: number;
    byPackage: { packageId: string; count: number; revenueKes: number }[];
    byProvider: { provider: string; count: number; revenueKes: number }[];
  };
};

/** GET /api/admin/analytics — Watch & Earn engagement + purchase revenue summary. */
export function adminGetAnalytics(token: string): Promise<ApiResult<{ success: boolean; analytics?: AdminAnalytics; message?: string }>> {
  return request("/admin/analytics", authed(token));
}

export type ContentItemAnalytics = {
  id: number;
  title: string;
  type: string;
  section: ContentSection;
  isActive: boolean;
  impressions: number;
  completions: number;
  uniqueClients: number;
  completionRate: number | null;
  totalEarnSecsAwarded: number;
  surveyQuestions: SurveyQuestion[] | null;
  surveyBreakdown: Record<string, { answer: string; count: number }[]> | null;
};

/** GET /api/admin/analytics/content/:id — per-item drill-down, including survey/quiz answer breakdown. */
export function adminGetContentAnalytics(token: string, id: number): Promise<ApiResult<{ success: boolean; detail?: ContentItemAnalytics; message?: string }>> {
  return request(`/admin/analytics/content/${encodeURIComponent(id)}`, authed(token));
}

// ── Settings ─────────────────────────────────────────────────────────────

export type AdminSettings = {
  earnConnectThresholdSecs: number;
  defaultActivatorCommissionRate: number;
  notificationRetentionDays: number;
};

/** GET /api/admin/settings */
export function adminGetSettings(token: string): Promise<ApiResult<{ success: boolean; settings?: AdminSettings; message?: string }>> {
  return request("/admin/settings", authed(token));
}

/** PATCH /api/admin/settings — any combination of the three fields may be sent. */
export function adminUpdateSettings(
  token: string,
  body: Partial<{ earnConnectThresholdMinutes: number; defaultActivatorCommissionPct: number; notificationRetentionDays: number }>
): Promise<ApiResult<{ success: boolean; settings?: AdminSettings; message?: string }>> {
  return request("/admin/settings", { method: "PATCH", body: JSON.stringify(body), ...authed(token) });
}

// ── Admin accounts (super_admin only) ───────────────────────────────────

export type AdminAccount = { id: number; username: string; role: "admin" | "super_admin"; created_at: string };

/** GET /api/admin/admins — 403 for a plain admin; only call this when isSuperAdmin. */
export function adminGetAdmins(token: string): Promise<ApiResult<{ admins: AdminAccount[]; message?: string }>> {
  return request("/admin/admins", authed(token));
}

/** POST /api/admin/admins — Body: { username, password, role? }. role defaults to 'admin'. */
export function adminCreateAdmin(token: string, body: { username: string; password: string; role?: "admin" | "super_admin" }): Promise<ApiResult<{ success: boolean; admin?: AdminAccount; message?: string }>> {
  return request("/admin/admins", { method: "POST", body: JSON.stringify(body), ...authed(token) });
}

/** PATCH /api/admin/admins/:id — Body: { role?, password? }. Blocked server-side if it would demote the last super_admin. */
export function adminUpdateAdmin(token: string, id: number, body: Partial<{ role: "admin" | "super_admin"; password: string }>): Promise<ApiResult<{ success: boolean; admin?: AdminAccount; message?: string }>> {
  return request(`/admin/admins/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body), ...authed(token) });
}

/** DELETE /api/admin/admins/:id — blocked server-side on your own account or the last remaining super_admin. */
export function adminDeleteAdmin(token: string, id: number): Promise<ApiResult<{ success: boolean; admin?: AdminAccount; message?: string }>> {
  return request(`/admin/admins/${encodeURIComponent(id)}`, { method: "DELETE", ...authed(token) });
}
