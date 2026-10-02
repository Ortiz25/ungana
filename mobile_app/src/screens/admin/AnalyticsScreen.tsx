// Ported from AdminDashboardScreen.svelte's 'analytics' tab — the stat-card
// summary, Content Overview list, per-item drill-down modal (with survey/
// quiz answer breakdown), the 14-day Purchases-by-Site/Purchases-by-Package
// timeline charts with their "View more" granularity + site/package
// drill-down, Revenue-by-Package, and By-Payment-Provider sections.
import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Eye, CheckCircle2, Users, Award, Radio, Wallet, Zap, RefreshCw, Video, FileText, ClipboardList, BookOpen, ChevronLeft } from "lucide-react-native";
import { useAdminAuth } from "@/flow/AdminAuthContext";
import {
  adminGetAnalytics,
  adminGetContentAnalytics,
  adminGetPurchasesBySite,
  adminGetPurchasesByPackage,
  adminGetSites,
  adminGetPackages,
  type AdminAnalytics,
  type ContentItemAnalytics,
  type PurchasesBySiteTimeline,
  type PurchasesByPackageTimeline,
  type TimelineGranularity,
  type Site,
  type Package,
} from "@/lib/adminApi";
import AdminModal from "@/components/admin/AdminModal";
import StatCard from "@/components/admin/StatCard";
import MultiLineChartMini from "@/components/MultiLineChartMini";

const GRANULARITIES: { id: TimelineGranularity; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="px-3 py-1.5 rounded-full" style={{ backgroundColor: active ? "#C45C38" : "rgba(255,255,255,0.1)" }}>
      <Text className="text-[11px] font-bold" style={{ color: active ? "#fff" : "#E8D4B0" }}>
        {label}
      </Text>
    </Pressable>
  );
}

const TYPE_ICON = { video: Video, article: FileText, survey: ClipboardList, lesson: BookOpen } as const;

function formatEarn(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { token, logout } = useAdminAuth();
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState<"earn" | "purchases">("earn");

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      const result = await adminGetAnalytics(token!);
      if (!result.ok && "status" in result && result.status === 401) {
        await logout();
        return;
      }
      if (result.ok && result.data.analytics) setAnalytics(result.data.analytics);
      setRefreshing(false);
    },
    [token, logout]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await adminGetAnalytics(token!);
      if (cancelled) return;
      if (!result.ok && "status" in result && result.status === 401) {
        await logout();
        return;
      }
      if (result.ok && result.data.analytics) setAnalytics(result.data.analytics);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ContentItemAnalytics | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function openDetail(id: number) {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    const result = await adminGetContentAnalytics(token!, id);
    setDetailLoading(false);
    if (result.ok && result.data.detail) setDetail(result.data.detail);
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
  }

  // ── Purchases-by-Site / Purchases-by-Package "View more" drill-downs ─────
  const [activeView, setActiveView] = useState<"none" | "site" | "package">("none");
  const [sites, setSites] = useState<Site[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);

  useEffect(() => {
    (async () => {
      const [sitesResult, packagesResult] = await Promise.all([adminGetSites(token!), adminGetPackages(token!)]);
      if (sitesResult.ok && sitesResult.data.sites) setSites(sitesResult.data.sites);
      if (packagesResult.ok && packagesResult.data.packages) setPackages(packagesResult.data.packages);
    })();
  }, [token]);

  // loadSiteDetail/loadPackageDetail are called directly from the triggering
  // event handler (opening the drill-down, tapping a granularity/filter
  // pill) rather than from a useEffect keyed on that state — an effect that
  // fires setState synchronously in its body trips
  // react-hooks/set-state-in-effect, and every trigger here is already a
  // direct user action, so there's no "derive from a prop/state change"
  // case an effect would actually be for. See CoordinatorDashboardScreen's
  // loadRegionsOnce for the same pattern.
  const [siteGranularity, setSiteGranularity] = useState<TimelineGranularity>("day");
  const [siteFilter, setSiteFilter] = useState<string>("");
  const [siteDetail, setSiteDetail] = useState<PurchasesBySiteTimeline | null>(null);
  const [siteDetailLoading, setSiteDetailLoading] = useState(false);

  const loadSiteDetail = useCallback(
    async (granularity: TimelineGranularity = siteGranularity, siteId: string = siteFilter) => {
      setSiteDetailLoading(true);
      const result = await adminGetPurchasesBySite(token!, { granularity, siteId: siteId || undefined });
      if (result.ok && result.data.timeline) setSiteDetail(result.data.timeline);
      setSiteDetailLoading(false);
    },
    [token, siteGranularity, siteFilter]
  );

  function openSiteDetail() {
    setActiveView("site");
    loadSiteDetail();
  }

  function selectSiteGranularity(g: TimelineGranularity) {
    setSiteGranularity(g);
    loadSiteDetail(g, siteFilter);
  }

  function selectSiteFilter(id: string) {
    setSiteFilter(id);
    loadSiteDetail(siteGranularity, id);
  }

  const siteTotals = siteDetail
    ? [...siteDetail.series]
        .map((s) => ({
          siteId: s.siteId,
          siteName: s.siteName,
          revenueKes: s.data.reduce((sum, v) => sum + v, 0),
          sessions: s.counts.reduce((sum, v) => sum + v, 0),
        }))
        .sort((a, b) => b.revenueKes - a.revenueKes)
    : [];

  const [packageGranularity, setPackageGranularity] = useState<TimelineGranularity>("day");
  const [packageFilter, setPackageFilter] = useState<string>("");
  const [packageDetail, setPackageDetail] = useState<PurchasesByPackageTimeline | null>(null);
  const [packageDetailLoading, setPackageDetailLoading] = useState(false);

  const loadPackageDetail = useCallback(
    async (granularity: TimelineGranularity = packageGranularity, packageId: string = packageFilter) => {
      setPackageDetailLoading(true);
      const result = await adminGetPurchasesByPackage(token!, { granularity, packageId: packageId || undefined });
      if (result.ok && result.data.timeline) setPackageDetail(result.data.timeline);
      setPackageDetailLoading(false);
    },
    [token, packageGranularity, packageFilter]
  );

  function openPackageDetail() {
    setActiveView("package");
    loadPackageDetail();
  }

  function selectPackageGranularity(g: TimelineGranularity) {
    setPackageGranularity(g);
    loadPackageDetail(g, packageFilter);
  }

  function selectPackageFilter(id: string) {
    setPackageFilter(id);
    loadPackageDetail(packageGranularity, id);
  }

  const packageTotals = packageDetail
    ? [...packageDetail.series]
        .map((s) => ({
          packageId: s.packageId,
          packageLabel: s.packageLabel,
          purchases: s.data.reduce((sum, v) => sum + v, 0),
          revenueKes: s.revenue.reduce((sum, v) => sum + v, 0),
        }))
        .sort((a, b) => b.purchases - a.purchases)
    : [];

  if (loading || !analytics) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#1D3C2A" }}>
        <ActivityIndicator color="#c29d53" />
      </View>
    );
  }

  const maxContentImpressions = Math.max(1, ...analytics.earned.contentOverview.map((c) => c.impressions));
  const maxPackageRevenue = Math.max(1, ...analytics.purchased.byPackage.map((p) => p.revenueKes));

  const headerRefreshing = activeView === "site" ? siteDetailLoading : activeView === "package" ? packageDetailLoading : refreshing;
  const onHeaderRefresh = activeView === "site" ? () => loadSiteDetail() : activeView === "package" ? () => loadPackageDetail() : () => load(true);

  return (
    <View className="flex-1" style={{ backgroundColor: "#1D3C2A" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#c29d53" />}>
        <View className="flex-row items-center justify-between">
          {activeView === "site" ? (
            <Pressable onPress={() => setActiveView("none")} className="flex-row items-center gap-1">
              <ChevronLeft size={16} color="#E8D4B0" />
              <Text className="text-sm font-bold" style={{ color: "#E8D4B0" }}>
                Purchases by Site
              </Text>
            </Pressable>
          ) : activeView === "package" ? (
            <Pressable onPress={() => setActiveView("none")} className="flex-row items-center gap-1">
              <ChevronLeft size={16} color="#E8D4B0" />
              <Text className="text-sm font-bold" style={{ color: "#E8D4B0" }}>
                Purchases by Package
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable onPress={onHeaderRefresh} disabled={headerRefreshing} className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", opacity: headerRefreshing ? 0.6 : 1 }}>
            <RefreshCw size={12} color="#C4DAC0" />
            <Text className="text-[11px] font-bold" style={{ color: "#C4DAC0" }}>
              Refresh
            </Text>
          </Pressable>
        </View>

        {activeView === "none" && (
          <View className="flex-row" style={{ gap: 4, padding: 4, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)" }}>
            <Pressable onPress={() => setSection("earn")} className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl" style={{ backgroundColor: section === "earn" ? "#2E5A3E" : "transparent" }}>
              <Zap size={13} color={section === "earn" ? "#E8D4B0" : "#3C6A4A"} />
              <Text className="text-xs font-bold" style={{ color: section === "earn" ? "#E8D4B0" : "#3C6A4A" }}>
                Watch & Earn
              </Text>
            </Pressable>
            <Pressable onPress={() => setSection("purchases")} className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl" style={{ backgroundColor: section === "purchases" ? "#2E5A3E" : "transparent" }}>
              <Wallet size={13} color={section === "purchases" ? "#E8D4B0" : "#3C6A4A"} />
              <Text className="text-xs font-bold" style={{ color: section === "purchases" ? "#E8D4B0" : "#3C6A4A" }}>
                Purchases
              </Text>
            </Pressable>
          </View>
        )}

        {activeView === "site" ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {GRANULARITIES.map((g) => (
                <Pill key={g.id} label={g.label} active={siteGranularity === g.id} onPress={() => selectSiteGranularity(g.id)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <Pill label="All sites" active={siteFilter === ""} onPress={() => selectSiteFilter("")} />
              {sites.map((s) => (
                <Pill key={s.id} label={s.name} active={siteFilter === s.id} onPress={() => selectSiteFilter(s.id)} />
              ))}
            </ScrollView>

            {siteDetailLoading && !siteDetail ? (
              <View className="items-center justify-center py-12">
                <ActivityIndicator color="#c29d53" />
              </View>
            ) : siteDetail ? (
              <>
                <View className="rounded-2xl px-4 pt-3.5 pb-4" style={{ backgroundColor: "#2E5A3E", opacity: siteDetailLoading ? 0.6 : 1 }}>
                  {siteDetail.series.length === 0 ? (
                    <Text className="text-xs text-center py-8" style={{ color: "#96B496" }}>
                      No purchases in this window.
                    </Text>
                  ) : (
                    <MultiLineChartMini days={siteDetail.periods} series={siteDetail.series} height={200} showGrid showYLabels />
                  )}
                </View>

                {siteTotals.length > 0 && (
                  <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E" }}>
                    <View className="px-4 pt-3.5 pb-2">
                      <Text className="text-xs font-bold uppercase" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
                        Totals for this window
                      </Text>
                    </View>
                    {siteTotals.map((t, i) => (
                      <View key={t.siteId ?? i} className="flex-row items-center justify-between px-4 py-2.5" style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.1)" }}>
                        <Text className="text-xs" style={{ color: "#E8D4B0" }}>
                          {t.siteName}
                        </Text>
                        <Text className="text-xs" style={{ color: "#96B496" }}>
                          {t.sessions} sessions · <Text style={{ fontWeight: "700", color: "#C45C38" }}>KES {t.revenueKes.toLocaleString()}</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : null}
          </>
        ) : activeView === "package" ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {GRANULARITIES.map((g) => (
                <Pill key={g.id} label={g.label} active={packageGranularity === g.id} onPress={() => selectPackageGranularity(g.id)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <Pill label="All packages" active={packageFilter === ""} onPress={() => selectPackageFilter("")} />
              {packages.map((p) => (
                <Pill key={p.id} label={p.label} active={packageFilter === p.id} onPress={() => selectPackageFilter(p.id)} />
              ))}
            </ScrollView>

            {packageDetailLoading && !packageDetail ? (
              <View className="items-center justify-center py-12">
                <ActivityIndicator color="#c29d53" />
              </View>
            ) : packageDetail ? (
              <>
                <View className="rounded-2xl px-4 pt-3.5 pb-4" style={{ backgroundColor: "#2E5A3E", opacity: packageDetailLoading ? 0.6 : 1 }}>
                  {packageDetail.series.length === 0 ? (
                    <Text className="text-xs text-center py-8" style={{ color: "#96B496" }}>
                      No purchases in this window.
                    </Text>
                  ) : (
                    <>
                      <Text className="text-[9px] uppercase mb-2" style={{ color: "#96B496", letterSpacing: 1 }}>
                        Purchases (count)
                      </Text>
                      <MultiLineChartMini
                        days={packageDetail.periods}
                        series={packageDetail.series.map((s) => ({ siteId: s.packageId, siteName: s.packageLabel, data: s.data }))}
                        height={200}
                        showGrid
                        showYLabels
                      />
                    </>
                  )}
                </View>

                {packageTotals.length > 0 && (
                  <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E" }}>
                    <View className="px-4 pt-3.5 pb-2">
                      <Text className="text-xs font-bold uppercase" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
                        Totals for this window
                      </Text>
                    </View>
                    {packageTotals.map((t, i) => (
                      <View key={t.packageId ?? i} className="flex-row items-center justify-between px-4 py-2.5" style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.1)" }}>
                        <Text className="text-xs" style={{ color: "#E8D4B0" }}>
                          {t.packageLabel}
                        </Text>
                        <Text className="text-xs" style={{ color: "#96B496" }}>
                          {t.purchases} purchases · <Text style={{ fontWeight: "700", color: "#C45C38" }}>KES {t.revenueKes.toLocaleString()}</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : null}
          </>
        ) : section === "earn" ? (
          <>
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
              <StatCard icon={Eye} label="Impressions" value={analytics.earned.totalImpressions.toLocaleString()} color="#C45C38" />
              <StatCard icon={CheckCircle2} label="Completions" value={analytics.earned.totalCompletions.toLocaleString()} color="#4E8050" />
              <StatCard icon={Users} label="Clients Engaged" value={analytics.earned.uniqueClientsEngaged.toLocaleString()} color="#5B8ED6" />
              <StatCard icon={Award} label="Granted Sessions" value={analytics.earned.sessionsGrantedViaEarning.toLocaleString()} color="#CC8830" />
              <StatCard icon={Radio} label="Active Now" value={analytics.earned.activeSessionsNow.toLocaleString()} color="#5B8ED6" />
            </View>

            <View className="rounded-2xl px-4 py-3.5" style={{ backgroundColor: "#2E5A3E" }}>
              <Text className="text-[10px] uppercase mb-1" style={{ color: "#96B496", letterSpacing: 1 }}>
                Reward time earned / claimed
              </Text>
              <Text className="text-lg font-bold" style={{ color: "#E8D4B0" }}>
                {formatEarn(analytics.earned.totalEarnedSecs)} <Text style={{ fontSize: 12, color: "#96B496", fontWeight: "400" }}>earned</Text>
                <Text style={{ color: "#4A6842" }}> · </Text>
                {formatEarn(analytics.earned.totalClaimedSecs)} <Text style={{ fontSize: 12, color: "#96B496", fontWeight: "400" }}>claimed</Text>
              </Text>
            </View>

            {analytics.earned.contentOverview.length > 0 && (
              <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E" }}>
                <View className="flex-row items-center justify-between px-4 pt-3.5 pb-2">
                  <View>
                    <Text className="text-xs font-bold uppercase" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
                      Content Overview
                    </Text>
                    <Text className="text-[10px]" style={{ color: "#96B496" }}>
                      Tap an item for interaction details
                    </Text>
                  </View>
                  <Text className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#96B496" }}>
                    {analytics.earned.contentOverview.length}
                  </Text>
                </View>
                {analytics.earned.contentOverview.map((c, i) => {
                  const impressionsPct = Math.round((c.impressions / maxContentImpressions) * 100);
                  const completionRate = c.impressions > 0 ? c.completions / c.impressions : 0;
                  const completionsPct = impressionsPct * completionRate;
                  return (
                    <Pressable key={c.id} onPress={() => openDetail(c.id)} className="flex-row items-center gap-3 px-4 py-2.5" style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.1)", opacity: c.isActive ? 1 : 0.55 }}>
                      <Text className="text-xs font-bold w-4 text-center" style={{ color: "#96B496" }}>
                        {i + 1}
                      </Text>
                      <View className="flex-1 min-w-0">
                        <View className="flex-row items-center justify-between gap-2 mb-1">
                          <Text numberOfLines={1} className="flex-1 text-xs" style={{ color: "#E8D4B0" }}>
                            {c.title}
                          </Text>
                          <Text className="text-[9px] font-bold" style={{ color: "#4E8050" }}>
                            {Math.round(completionRate * 100)}%
                          </Text>
                        </View>
                        <View className="relative rounded-full overflow-hidden" style={{ height: 6, backgroundColor: "rgba(255,255,255,0.08)" }}>
                          <View className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${impressionsPct}%`, backgroundColor: "rgba(150,180,150,0.4)" }} />
                          <View className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${completionsPct}%`, backgroundColor: "#4E8050" }} />
                        </View>
                      </View>
                      <View className="items-end" style={{ gap: 2 }}>
                        <View className="flex-row items-center gap-1">
                          <Eye size={9} color="#96B496" />
                          <Text className="text-[10px]" style={{ color: "#96B496" }}>
                            {c.impressions}
                          </Text>
                        </View>
                        <Text className="text-[10px] font-bold" style={{ color: "#4E8050" }}>
                          {c.completions} done
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
              <StatCard icon={CheckCircle2} label="Paid Sessions" value={analytics.purchased.totalPaidSessions.toLocaleString()} color="#4E8050" />
              <StatCard icon={Radio} label="Active Now" value={analytics.purchased.activeSessionsNow.toLocaleString()} color="#5B8ED6" />
              <StatCard icon={Wallet} label="Revenue" value={`KES ${analytics.purchased.totalRevenueKes.toLocaleString()}`} color="#C45C38" />
              <StatCard icon={Award} label="Commission Paid" value={`KES ${analytics.purchased.totalCommissionKes.toLocaleString()}`} color="#CC8830" />
            </View>

            {analytics.purchased.bySiteTimeline?.series.length > 0 && (
              <View className="rounded-2xl overflow-hidden px-4 pt-3.5 pb-4" style={{ backgroundColor: "#2E5A3E" }}>
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className="text-xs font-bold uppercase" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
                    Purchases by Site (last 14 days)
                  </Text>
                  <Pressable onPress={openSiteDetail}>
                    <Text className="text-[11px] font-bold" style={{ color: "#C45C38" }}>
                      View more →
                    </Text>
                  </Pressable>
                </View>
                <Text className="text-[9px] uppercase mb-2" style={{ color: "#96B496", letterSpacing: 1 }}>
                  Revenue (KES)
                </Text>
                <MultiLineChartMini days={analytics.purchased.bySiteTimeline.days} series={analytics.purchased.bySiteTimeline.series} height={160} showGrid showYLabels />
              </View>
            )}

            {analytics.purchased.byPackageTimeline?.series.length > 0 && (
              <View className="rounded-2xl overflow-hidden px-4 pt-3.5 pb-4" style={{ backgroundColor: "#2E5A3E" }}>
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className="text-xs font-bold uppercase" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
                    Purchases by Package (last 14 days)
                  </Text>
                  <Pressable onPress={openPackageDetail}>
                    <Text className="text-[11px] font-bold" style={{ color: "#C45C38" }}>
                      View more →
                    </Text>
                  </Pressable>
                </View>
                <Text className="text-[9px] uppercase mb-2" style={{ color: "#96B496", letterSpacing: 1 }}>
                  Purchase count
                </Text>
                <MultiLineChartMini
                  days={analytics.purchased.byPackageTimeline.days}
                  series={analytics.purchased.byPackageTimeline.series.map((s) => ({ siteId: s.packageId, siteName: s.packageLabel, data: s.data }))}
                  height={160}
                  showGrid
                  showYLabels
                />
              </View>
            )}

            {analytics.purchased.byPackage.length > 0 && (
              <View className="rounded-2xl overflow-hidden px-4 py-3.5" style={{ backgroundColor: "#2E5A3E", gap: 8 }}>
                <Text className="text-xs font-bold uppercase" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
                  Revenue by Package
                </Text>
                {analytics.purchased.byPackage.map((p) => (
                  <View key={p.packageId} style={{ gap: 3 }}>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[11px]" style={{ color: "#E8D4B0" }}>
                        {p.packageId}
                      </Text>
                      <Text className="text-[11px] font-bold" style={{ color: "#C45C38" }}>
                        KES {p.revenueKes.toLocaleString()}
                      </Text>
                    </View>
                    <View className="rounded-full overflow-hidden" style={{ height: 8, backgroundColor: "rgba(255,255,255,0.08)" }}>
                      <View className="h-full rounded-full" style={{ width: `${Math.round((p.revenueKes / maxPackageRevenue) * 100)}%`, backgroundColor: "#C45C38" }} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {analytics.purchased.byProvider.length > 0 && (
              <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E" }}>
                <View className="px-4 pt-3.5 pb-2">
                  <Text className="text-xs font-bold uppercase" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
                    By Payment Provider
                  </Text>
                </View>
                {analytics.purchased.byProvider.map((p, i) => (
                  <View key={p.provider} className="flex-row items-center justify-between px-4 py-2.5" style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.1)" }}>
                    <Text className="text-xs capitalize" style={{ color: "#E8D4B0" }}>
                      {p.provider}
                    </Text>
                    <Text className="text-xs" style={{ color: "#96B496" }}>
                      {p.count} sessions · <Text style={{ fontWeight: "700", color: "#C45C38" }}>KES {p.revenueKes.toLocaleString()}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <AdminModal visible={!!detailId} title="Content details" onClose={closeDetail}>
        {detailLoading ? (
          <ActivityIndicator color="#c29d53" />
        ) : detail ? (
          <>
            <View className="flex-row items-center gap-3">
              <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.2)" }}>
                {(() => {
                  const ItemIcon = TYPE_ICON[detail.type as keyof typeof TYPE_ICON];
                  return ItemIcon ? <ItemIcon size={18} color="#C45C38" /> : null;
                })()}
              </View>
              <View className="flex-1 min-w-0">
                <Text numberOfLines={1} className="text-sm font-bold" style={{ color: "#E8D4B0" }}>
                  {detail.title}
                </Text>
                <Text className="text-[10px] capitalize" style={{ color: "#96B496" }}>
                  {detail.type} · <Text style={{ color: detail.isActive ? "#4E8050" : "#B85038" }}>{detail.isActive ? "Active" : "Inactive"}</Text>
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              <StatCard icon={Eye} label="Impressions" value={detail.impressions.toLocaleString()} color="#C45C38" />
              <StatCard icon={CheckCircle2} label="Completions" value={detail.completions.toLocaleString()} color="#4E8050" />
              <StatCard icon={Users} label="Unique Clients" value={detail.uniqueClients.toLocaleString()} color="#5B8ED6" />
              <StatCard icon={Award} label="Completion Rate" value={detail.completionRate != null ? `${Math.round(detail.completionRate * 100)}%` : "—"} color="#CC8830" />
            </View>

            <View className="flex-row items-center justify-between rounded-2xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text className="text-[11px]" style={{ color: "#96B496" }}>
                Total reward time awarded
              </Text>
              <Text className="text-sm font-bold" style={{ color: "#C45C38" }}>
                {formatEarn(detail.totalEarnSecsAwarded)}
              </Text>
            </View>

            {(detail.type === "survey" || detail.type === "lesson") && (detail.surveyQuestions?.length ?? 0) > 0 && (
              <>
                <Text className="text-[10px] font-bold uppercase mt-1" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
                  {detail.type === "lesson" ? "Quiz breakdown" : "Answer breakdown"}
                </Text>
                {detail.surveyQuestions!.map((q, qi) => {
                  const answers = detail.surveyBreakdown?.[String(qi)] ?? [];
                  const totalAnswers = answers.reduce((s, a) => s + a.count, 0);
                  const topCount = Math.max(0, ...answers.map((a) => a.count));
                  return (
                    <View key={qi} className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", gap: 6 }}>
                      <View className="flex-row items-start justify-between gap-2">
                        <Text className="flex-1 text-xs font-sans-semibold" style={{ color: "#E8D4B0" }}>
                          {qi + 1}. {q.question}
                        </Text>
                        <Text className="text-[9px]" style={{ color: "#96B496" }}>
                          {totalAnswers} response{totalAnswers === 1 ? "" : "s"}
                        </Text>
                      </View>
                      {totalAnswers === 0 ? (
                        <Text className="text-[10px] italic" style={{ color: "#6B8A6B" }}>
                          No answers yet
                        </Text>
                      ) : (
                        answers.map((a) => {
                          const pct = Math.round((a.count / totalAnswers) * 100);
                          const isTop = a.count === topCount;
                          return (
                            <View key={a.answer} className="flex-row items-center gap-2">
                              <Text numberOfLines={1} className="text-[10px]" style={{ width: 80, textAlign: "right", color: isTop ? "#E8D4B0" : "#96B496", fontWeight: isTop ? "700" : "400" }}>
                                {a.answer}
                              </Text>
                              <View className="flex-1 rounded-full overflow-hidden" style={{ height: 6, backgroundColor: "rgba(255,255,255,0.08)" }}>
                                <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: isTop ? "#4E8050" : "rgba(150,180,150,0.5)" }} />
                              </View>
                              <Text className="text-[9px]" style={{ color: "#96B496", width: 28 }}>
                                {pct}%
                              </Text>
                            </View>
                          );
                        })
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </>
        ) : (
          <Text className="text-[11px] text-center py-6" style={{ color: "#96B496" }}>
            Could not load details.
          </Text>
        )}
      </AdminModal>
    </View>
  );
}
