// Ported from frontend/src/lib/screens/CoordinatorDashboardScreen.svelte —
// real-mode (isReal) branches only; the offline/demo-fallback half (fake AP
// hardware grid, ACT_WEEKLY/MONTHLY/YEARLY mock data, editable per-activator
// targets, nudge buttons) is deliberately not ported — see the plan doc.
// Reads CoordinatorAuthContext directly, same convention as
// ActivatorDashboardScreen/CoordinatorsScreen.tsx.
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import {
  ShieldCheck, MapPin, LogOut, ArrowLeft, TrendingUp, Radio, Users, Wallet, AlertTriangle,
  Send, CheckCircle2, ChevronRight, ChevronDown, RefreshCw,
} from "lucide-react-native";
import { useCoordinatorAuth } from "@/flow/CoordinatorAuthContext";
import {
  getCoordinatorActivators,
  getCoordinatorEarnings,
  getCoordinatorActivatorHistory,
  getCoordinatorEscalations,
  createCoordinatorEscalation,
  updateCoordinatorEscalationStatus,
  getCoordinatorRegions,
  getCoordinatorNetworkStatus,
  type CoordinatorActivator,
  type CoordinatorEarnings,
  type CoordinatorEscalation,
  type CoordinatorRegion,
  type CoordinatorNetworkStatus,
  type CoordinatorHistoryBucket,
} from "@/lib/coordinatorApi";
import BarChartMini from "@/components/BarChartMini";

const TABS = [
  { id: "overview", label: "Overview", Icon: TrendingUp },
  { id: "network", label: "Regions", Icon: MapPin },
  { id: "activators", label: "Team", Icon: Users },
  { id: "escalations", label: "Issues", Icon: ShieldCheck },
] as const;
type TabId = (typeof TABS)[number]["id"];
type HistoryPeriod = "week" | "month" | "year";

const ESC_PRIORITY_COLOR: Record<string, string> = { high: "#B85038", medium: "#CC8830", low: "#C4DAC0" };
const CIRCUMFERENCE = 226.2;

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("");
}
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function historyBucketLabel(bucket: string, period: HistoryPeriod): string {
  const d = new Date(bucket);
  if (period === "week") return d.toLocaleDateString("en-GB", { weekday: "short" });
  if (period === "month") return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return d.toLocaleDateString("en-GB", { month: "short" });
}

function HealthDonut({ pct, color, size = 96, label = "health" }: { pct: number; color: string; size?: number; label?: string }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg viewBox="0 0 100 100" width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={50} cy={50} r={36} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={10} />
        <Circle
          cx={50} cy={50} r={36} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="font-bold" style={{ fontSize: size > 80 ? 20 : 16, color: "#E8D4B0" }}>{pct}%</Text>
        <Text className="uppercase" style={{ fontSize: 8, color: "#C4DAC0", letterSpacing: 0.5 }}>{label}</Text>
      </View>
    </View>
  );
}

export default function CoordinatorDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { coordinator, token, logout } = useCoordinatorAuth();

  const [activators, setActivators] = useState<CoordinatorActivator[]>([]);
  const [earnings, setEarnings] = useState<CoordinatorEarnings | null>(null);
  const [escalations, setEscalations] = useState<CoordinatorEscalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [network, setNetwork] = useState<CoordinatorNetworkStatus>(null);
  const [networkLoading, setNetworkLoading] = useState(true);

  const [regions, setRegions] = useState<CoordinatorRegion[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsLoaded, setRegionsLoaded] = useState(false);

  const [tab, setTab] = useState<TabId>("overview");

  const [drillId, setDrillId] = useState<number | null>(null);
  const [history, setHistory] = useState<CoordinatorHistoryBucket[]>([]);
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("week");
  const [historyLoading, setHistoryLoading] = useState(false);

  const [composing, setComposing] = useState(false);
  const [composeText, setComposeText] = useState("");
  const [composePriority, setComposePriority] = useState<"low" | "medium" | "high">("medium");
  const [composeSubmitting, setComposeSubmitting] = useState(false);

  const loadNetworkStatus = useCallback(async () => {
    setNetworkLoading(true);
    const result = await getCoordinatorNetworkStatus(token!);
    setNetwork(result.ok ? (result.data?.network ?? null) : null);
    setNetworkLoading(false);
  }, [token]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      const [activatorsResult, earningsResult, escalationsResult] = await Promise.all([
        getCoordinatorActivators(token!),
        getCoordinatorEarnings(token!),
        getCoordinatorEscalations(token!),
        loadNetworkStatus(),
      ]);
      if ([activatorsResult, earningsResult, escalationsResult].some((r) => "status" in r && r.status === 401)) {
        await logout();
        return;
      }
      if (activatorsResult.ok) setActivators(activatorsResult.data?.activators ?? []);
      if (earningsResult.ok) setEarnings(earningsResult.data?.earnings ?? null);
      if (escalationsResult.ok) setEscalations(escalationsResult.data?.escalations ?? []);
      setLoading(false);
      setRefreshing(false);
    },
    [token, logout, loadNetworkStatus]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [activatorsResult, earningsResult, escalationsResult] = await Promise.all([
        getCoordinatorActivators(token!),
        getCoordinatorEarnings(token!),
        getCoordinatorEscalations(token!),
        loadNetworkStatus(),
      ]);
      if (cancelled) return;
      if ([activatorsResult, earningsResult, escalationsResult].some((r) => "status" in r && r.status === 401)) {
        await logout();
        return;
      }
      if (activatorsResult.ok) setActivators(activatorsResult.data?.activators ?? []);
      if (earningsResult.ok) setEarnings(earningsResult.data?.earnings ?? null);
      if (escalationsResult.ok) setEscalations(escalationsResult.data?.escalations ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Both region-loading and history-loading are triggered directly from the
  // event handlers that change `tab`/`drillId`/`historyPeriod` (selectTab/
  // openDrill/selectHistoryPeriod below) rather than from a useEffect keyed
  // on that state — an effect that fires setState synchronously in its body
  // trips react-hooks/set-state-in-effect, and every trigger here is already
  // a direct user action (a tab tap, a row tap, a period tap), so there's no
  // "derive from a prop/state change" case an effect would actually be for.
  async function loadRegionsOnce() {
    if (regionsLoaded) return;
    setRegionsLoaded(true);
    setRegionsLoading(true);
    const result = await getCoordinatorRegions(token!);
    setRegions(result.ok ? (result.data?.regions ?? []) : []);
    setRegionsLoading(false);
  }
  function selectTab(id: TabId) {
    setTab(id);
    if (id === "network") loadRegionsOnce();
  }

  const drillAct = useMemo(() => (drillId ? activators.find((a) => a.id === drillId) ?? null : null), [drillId, activators]);
  const historyRequestRef = useRef(0);

  async function loadHistory(activatorId: number, period: HistoryPeriod) {
    const requestId = ++historyRequestRef.current;
    setHistoryLoading(true);
    setHistory([]);
    const result = await getCoordinatorActivatorHistory(token!, activatorId, period);
    if (historyRequestRef.current !== requestId) return; // superseded by a newer request
    setHistory(result.ok ? (result.data?.history ?? []) : []);
    setHistoryLoading(false);
  }
  function openDrill(id: number) {
    setDrillId(id);
    loadHistory(id, historyPeriod);
  }
  function selectHistoryPeriod(p: HistoryPeriod) {
    setHistoryPeriod(p);
    if (drillId != null) loadHistory(drillId, p);
  }

  const historyChartData = useMemo(
    () => history.map((h) => ({ label: historyBucketLabel(h.bucket, historyPeriod), earn: Number(h.commission_kes) })),
    [history, historyPeriod]
  );

  const grossKes = Number(earnings?.gross_kes ?? 0);
  const commissionKes = Number(earnings?.commission_kes ?? 0);
  const paidSessions = Number(earnings?.paid_sessions ?? 0);
  const activatorCount = Number(earnings?.activator_count ?? activators.length);

  const onlineAPs = network?.totals?.onlineAPs ?? 0;
  const degradedAPs = network?.totals?.degradedAPs ?? 0;
  const offlineAPs = network?.totals?.offlineAPs ?? 0;
  const totalAPs = network?.totals?.totalAPs ?? 0;
  const totalClients = network?.totals?.totalClients ?? 0;
  const networkHealth = totalAPs > 0 ? Math.round((onlineAPs / totalAPs) * 100) : 0;
  const healthColor = networkHealth >= 90 ? "#4E8050" : networkHealth >= 70 ? "#CC8830" : "#B85038";
  const healthLabel = networkHealth >= 90 ? "Healthy" : networkHealth >= 70 ? "Degraded" : "Critical";

  const openEscs = useMemo(() => escalations.filter((e) => e.status === "open"), [escalations]);

  async function submitEscalation() {
    if (!composeText.trim() || composeSubmitting) return;
    setComposeSubmitting(true);
    const result = await createCoordinatorEscalation(token!, { issue: composeText.trim(), priority: composePriority });
    setComposeSubmitting(false);
    if (result.ok && result.data?.escalation) {
      setEscalations((prev) => [result.data!.escalation, ...prev]);
      setComposing(false);
      setComposeText("");
      setComposePriority("medium");
    }
  }

  async function setEscalationStatus(id: number, status: "open" | "resolved" | "escalated") {
    const prev = escalations;
    setEscalations((es) => es.map((e) => (e.id === id ? { ...e, status } : e)));
    const result = await updateCoordinatorEscalationStatus(token!, id, status);
    if (!result.ok) setEscalations(prev); // revert an optimistic update the backend didn't actually accept
  }

  if (!coordinator) return null;

  // ── Drill-down ────────────────────────────────────────────────────────
  if (drillAct) {
    return (
      <View className="flex-1" style={{ backgroundColor: "#E8D4B0" }}>
        <ScrollView>
          <View className="px-5" style={{ paddingTop: insets.top + 16, paddingBottom: 56, backgroundColor: "#1D3C2A" }}>
            <View className="flex-row items-center gap-3 mb-5">
              <Pressable onPress={() => setDrillId(null)} className="w-8 h-8 rounded-full items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.10)" }}>
                <ArrowLeft size={15} color="#E8D4B0" />
              </Pressable>
              <Text className="uppercase font-semibold" style={{ fontSize: 10, color: "#C4DAC0", letterSpacing: 1 }}>Activator Profile</Text>
              <View className="ml-auto flex-row rounded-xl overflow-hidden" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
                {(["week", "month", "year"] as HistoryPeriod[]).map((p) => (
                  <Pressable key={p} onPress={() => selectHistoryPeriod(p)} className="px-2.5 py-1" style={{ backgroundColor: historyPeriod === p ? "#C45C38" : "transparent" }}>
                    <Text className="font-bold capitalize" style={{ fontSize: 9, color: historyPeriod === p ? "#fff" : "#96B496" }}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View className="flex-row items-center gap-4">
              <View className="w-16 h-16 rounded-2xl items-center justify-center shrink-0" style={{ backgroundColor: "rgba(196,92,56,0.35)" }}>
                <Text className="font-bold text-lg" style={{ color: "#C45C38" }}>{initials(drillAct.name)}</Text>
              </View>
              <View className="flex-1 min-w-0">
                <Text className="font-serif font-bold text-base" style={{ color: "#E8D4B0" }}>{drillAct.name}</Text>
                <Text className="text-[10px] mb-2" style={{ color: "#C4DAC0" }}>
                  {!!drillAct.territory && `${drillAct.territory} · `}{drillAct.code}
                </Text>
                <View className="px-2 py-0.5 rounded-full self-start" style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>
                  <Text className="font-bold capitalize" style={{ fontSize: 9, color: "#C4DAC0" }}>{drillAct.status}</Text>
                </View>
              </View>
            </View>
          </View>

          <View className="mx-4 rounded-3xl overflow-hidden flex-row" style={{ marginTop: -40, backgroundColor: "#162C1E" }}>
            {[
              { label: "Sessions", value: String(Number(drillAct.paid_sessions)), sub: "paid" },
              { label: "Gross", value: `KES ${Number(drillAct.gross_kes).toLocaleString()}`, sub: "all-time" },
              { label: "Commission", value: `KES ${Number(drillAct.commission_kes).toLocaleString()}`, sub: "all-time" },
              { label: "Dormant", value: String(Number(drillAct.dormant_count)), sub: "users" },
            ].map((s, i) => (
              <View key={s.label} className="flex-1 items-center py-3 px-1.5" style={{ borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: "rgba(255,255,255,0.14)" }}>
                <Text numberOfLines={1} className="font-bold" style={{ fontSize: 12, color: "#C45C38" }}>{s.value}</Text>
                <Text className="text-center mt-0.5 uppercase" style={{ fontSize: 8, color: "#C4DAC0" }}>{s.label}</Text>
                <Text className="text-center mt-0.5" style={{ fontSize: 8, color: "#96B496" }}>{s.sub}</Text>
              </View>
            ))}
          </View>

          <View className="px-4 pb-10" style={{ gap: 12, marginTop: 16 }}>
            <View className="rounded-2xl px-4 pt-4 pb-3" style={{ backgroundColor: "#2E5A3E" }}>
              <Text className="uppercase font-semibold mb-3" style={{ fontSize: 10, color: "#C4DAC0", letterSpacing: 0.5 }}>Commission by {historyPeriod}</Text>
              {historyLoading ? (
                <View className="py-8 items-center"><ActivityIndicator color="rgba(255,255,255,0.7)" /></View>
              ) : historyChartData.every((h) => h.earn === 0) ? (
                <Text className="text-xs text-center py-8" style={{ color: "#96B496" }}>No sessions in this period</Text>
              ) : (
                <View style={{ height: 90 }}>
                  <BarChartMini
                    data={historyChartData} yKey="earn" xKey="label" height={90} color="#C45C38"
                    barSize={historyPeriod === "year" ? 13 : historyPeriod === "month" ? 22 : 18}
                    radius={4} showGrid showYLabels yAxisWidth={30} labelColor="#96B496"
                  />
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Main dashboard ────────────────────────────────────────────────────
  return (
    <View className="flex-1" style={{ backgroundColor: "#E8D4B0" }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1D3C2A" />}>
        <View className="px-5" style={{ paddingTop: insets.top + 16, paddingBottom: 80, backgroundColor: "#1D3C2A" }}>
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-2xl items-center justify-center shrink-0" style={{ backgroundColor: "#C45C38" }}>
                <ShieldCheck size={18} color="#fff" />
              </View>
              <View>
                <Text className="uppercase font-semibold" style={{ fontSize: 9, color: "#C4DAC0", letterSpacing: 1 }}>Coordinator · {coordinator.id}</Text>
                <Text className="font-serif font-bold text-sm" style={{ color: "#E8D4B0" }}>{coordinator.name}</Text>
                {!!coordinator.territory && (
                  <Text className="text-[10px] flex-row items-center gap-1" style={{ color: "#AECAAE" }}><MapPin size={9} /> {coordinator.territory}</Text>
                )}
              </View>
            </View>
            <Pressable onPress={logout} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>
              <LogOut size={14} color="#C4DAC0" />
            </Pressable>
          </View>

          <View className="flex-row items-center gap-5">
            <HealthDonut pct={networkHealth} color={healthColor} />
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-1">
                <View className="rounded-full" style={{ width: 8, height: 8, backgroundColor: healthColor }} />
                <Text className="font-bold text-sm" style={{ color: healthColor }}>{healthLabel}</Text>
              </View>
              <Text className="text-[10px] mb-2" style={{ color: "#C4DAC0" }}>{coordinator.territory ?? "Your"} network</Text>
              <View className="flex-row" style={{ gap: 6 }}>
                {[
                  { v: onlineAPs, l: "Online", c: "#4E8050" },
                  { v: degradedAPs, l: "Degraded", c: "#CC8830" },
                  { v: offlineAPs, l: "Offline", c: "#B85038" },
                ].map((g) => (
                  <View key={g.l} className="flex-1 rounded-xl py-1.5 items-center" style={{ backgroundColor: "rgba(255,255,255,0.14)" }}>
                    <Text className="font-bold text-sm" style={{ color: g.c }}>{g.v}</Text>
                    <Text style={{ fontSize: 8, color: "#C4DAC0" }}>{g.l}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Floating stats strip */}
        <View className="mx-4 rounded-3xl overflow-hidden flex-row" style={{ marginTop: -48, backgroundColor: "#162C1E" }}>
          {[
            { label: "Active Users", value: String(totalClients), sub: "clients online", dest: "network" as TabId },
            { label: "Activators", value: String(activatorCount), sub: `${paidSessions} paid sessions`, dest: "activators" as TabId },
            { label: "Escalations", value: String(openEscs.length), sub: "open tickets", alert: openEscs.length > 0, dest: "escalations" as TabId },
          ].map((s, i) => (
            <Pressable key={s.label} onPress={() => selectTab(s.dest)} className="flex-1 items-center py-3 px-2" style={{ borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: "rgba(255,255,255,0.14)" }}>
              <Text className="font-bold" style={{ fontSize: 16, color: s.alert ? "#B85038" : "#C45C38" }}>{s.value}</Text>
              <Text className="text-center mt-0.5 uppercase" style={{ fontSize: 9, color: s.alert ? "#C07860" : "#C4DAC0" }}>{s.label}</Text>
              <Text className="text-center mt-0.5" style={{ fontSize: 9, color: "#96B496" }}>{s.sub}</Text>
            </Pressable>
          ))}
        </View>

        {/* Tab bar */}
        <View className="flex-row mx-4 mt-4 mb-4 rounded-2xl overflow-hidden p-1" style={{ backgroundColor: "rgba(46,90,62,0.12)", gap: 2 }}>
          {TABS.map((t) => (
            <Pressable key={t.id} onPress={() => selectTab(t.id)} className="flex-1 py-2 rounded-xl items-center" style={{ backgroundColor: tab === t.id ? "#2E5A3E" : "transparent", gap: 2 }}>
              <View style={{ position: "relative" }}>
                <t.Icon size={14} color={tab === t.id ? "#C45C38" : "#3C6A4A"} />
                {t.id === "escalations" && openEscs.length > 0 && (
                  <View className="rounded-full absolute" style={{ width: 6, height: 6, backgroundColor: "#B85038", top: -2, right: -2 }} />
                )}
              </View>
              <Text className="font-bold" style={{ fontSize: 9, color: tab === t.id ? "#E8D4B0" : "#3C6A4A" }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <View className="px-4 pb-10" style={{ gap: 12 }}>
          {tab === "overview" && (
            <>
              {openEscs.length > 0 && (
                <Pressable onPress={() => selectTab("escalations")} className="w-full rounded-2xl px-4 py-3 flex-row items-center justify-between" style={{ backgroundColor: "rgba(184,80,56,0.08)", borderWidth: 1, borderColor: "rgba(184,80,56,0.3)" }}>
                  <View className="flex-row items-center gap-2">
                    <AlertTriangle size={14} color="#B85038" />
                    <Text className="text-xs font-semibold" style={{ color: "#1D3C2A" }}>{openEscs.length} open issue{openEscs.length > 1 ? "s" : ""} need attention</Text>
                  </View>
                  <Text className="font-bold px-2 py-1 rounded-lg" style={{ fontSize: 10, backgroundColor: "rgba(184,80,56,0.12)", color: "#B85038" }}>Review →</Text>
                </Pressable>
              )}
              {offlineAPs > 0 && (
                <Pressable onPress={() => selectTab("network")} className="w-full rounded-2xl px-4 py-3 flex-row items-center justify-between" style={{ backgroundColor: "rgba(204,136,48,0.08)", borderWidth: 1, borderColor: "rgba(204,136,48,0.3)" }}>
                  <View className="flex-row items-center gap-2">
                    <Radio size={14} color="#CC8830" />
                    <Text className="text-xs font-semibold" style={{ color: "#1D3C2A" }}>{offlineAPs} AP{offlineAPs > 1 ? "s" : ""} offline — users affected</Text>
                  </View>
                  <Text className="font-bold px-2 py-1 rounded-lg" style={{ fontSize: 10, backgroundColor: "rgba(204,136,48,0.12)", color: "#CC8830" }}>Check →</Text>
                </Pressable>
              )}

              <View className="rounded-2xl px-4 pt-4 pb-4" style={{ backgroundColor: "#2E5A3E" }}>
                <View className="flex-row items-center gap-2 mb-3">
                  <Wallet size={14} color="#C45C38" />
                  <Text className="uppercase font-semibold" style={{ fontSize: 10, color: "#C4DAC0", letterSpacing: 0.5 }}>Team Commission (all-time)</Text>
                </View>
                <Text className="font-serif font-bold" style={{ fontSize: 22, color: "#E8D4B0" }}>KES {commissionKes.toLocaleString()}</Text>
                <Text style={{ fontSize: 9, color: "#96B496", marginTop: 2 }}>
                  from KES {grossKes.toLocaleString()} gross · {paidSessions} paid sessions across {activatorCount} activator{activatorCount === 1 ? "" : "s"}
                </Text>
              </View>
              <Pressable onPress={() => selectTab("activators")} className="w-full rounded-2xl px-4 py-3 flex-row items-center justify-between" style={{ backgroundColor: "rgba(46,90,62,0.1)", borderWidth: 1, borderColor: "rgba(46,90,62,0.2)" }}>
                <Text className="text-xs font-semibold" style={{ color: "#1D3C2A" }}>View team breakdown by activator</Text>
                <ChevronRight size={14} color="#3C6A4A" />
              </Pressable>
            </>
          )}

          {tab === "network" && (
            <>
              <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <View className="px-4 py-3.5 flex-row items-center justify-between gap-3">
                  <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                    <Radio size={14} color="#C45C38" />
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-bold" style={{ color: "#E8D4B0" }}>Network Status</Text>
                      {networkLoading ? (
                        <Text style={{ fontSize: 10, color: "#96B496" }}>Checking controller…</Text>
                      ) : network ? (
                        <Text style={{ fontSize: 10, color: "#96B496" }}>
                          {network.totals.onlineAPs} of {network.totals.totalAPs} access points online across {network.sites.length} site{network.sites.length === 1 ? "" : "s"} · {network.totals.totalClients} clients connected
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 10, color: "#96B496" }}>Unavailable right now</Text>
                      )}
                    </View>
                  </View>
                  <Pressable onPress={loadNetworkStatus} disabled={networkLoading} className="w-7 h-7 rounded-full items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.14)" }}>
                    <RefreshCw size={12} color="#C4DAC0" />
                  </Pressable>
                </View>
              </View>

              {(network?.sites?.length ?? 0) > 0 &&
                network!.sites.map((siteGroup) => (
                  <View key={siteGroup.site.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                    <View className="px-4 py-3 flex-row items-center justify-between">
                      <Text className="text-xs font-bold" style={{ color: "#E8D4B0" }}>{siteGroup.site.name}</Text>
                      <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(196,92,56,0.28)" }}>
                        <Text className="font-bold" style={{ fontSize: 9, color: "#C45C38" }}>{siteGroup.onlineAPs}/{siteGroup.totalAPs} online</Text>
                      </View>
                    </View>
                    {siteGroup.accessPoints.length > 0 ? (
                      <View className="px-4 pb-3.5" style={{ gap: 6 }}>
                        {siteGroup.accessPoints.map((ap) => {
                          const sc = ap.status === "online" ? "#4E8050" : ap.status === "degraded" ? "#CC8830" : "#B85038";
                          return (
                            <View key={ap.id} className="flex-row items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
                              <View className="rounded-full shrink-0" style={{ width: 8, height: 8, backgroundColor: sc }} />
                              <Text numberOfLines={1} className="flex-1 min-w-0 text-xs font-semibold" style={{ color: "#E8D4B0" }}>{ap.name}</Text>
                              <View className="px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${sc}22` }}>
                                <Text className="font-bold capitalize" style={{ fontSize: 9, color: sc }}>{ap.status}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text className="px-4 pb-3.5" style={{ fontSize: 11, color: "#96B496" }}>No access points adopted on this site</Text>
                    )}
                  </View>
                ))}

              <Text className="text-xs font-semibold" style={{ color: "#3C6A4A", marginTop: 4 }}>Regions</Text>
              {regionsLoading ? (
                <View className="py-8 items-center"><ActivityIndicator color="#1D3C2A" /></View>
              ) : regions.length === 0 ? (
                <View className="rounded-2xl px-4 py-8 items-center" style={{ backgroundColor: "#2E5A3E", gap: 8 }}>
                  <MapPin size={24} color="#96B496" />
                  <Text className="text-xs" style={{ color: "#96B496" }}>No activators assigned yet</Text>
                </View>
              ) : (
                regions.map((region) => (
                  <View key={region.territory} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E", borderWidth: 1, borderColor: Number(region.open_escalations) > 0 ? "rgba(184,80,56,0.35)" : "rgba(255,255,255,0.08)" }}>
                    <View className="px-4 pt-4 pb-3">
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center gap-2 flex-1 min-w-0">
                          <MapPin size={13} color="#C45C38" />
                          <Text numberOfLines={1} className="text-sm font-bold" style={{ color: "#E8D4B0" }}>{region.territory}</Text>
                        </View>
                        <View className="px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(196,92,56,0.28)" }}>
                          <Text className="font-bold" style={{ fontSize: 10, color: "#C45C38" }}>{region.activator_count} activator{Number(region.activator_count) === 1 ? "" : "s"}</Text>
                        </View>
                      </View>
                      <View className="flex-row" style={{ gap: 8 }}>
                        <View className="flex-1 rounded-xl px-2 py-2" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
                          <Text className="text-xs font-bold" style={{ color: "#E8D4B0" }}>{Number(region.paid_sessions)}</Text>
                          <Text style={{ fontSize: 9, color: "#C4DAC0" }}>sessions</Text>
                        </View>
                        <View className="flex-1 rounded-xl px-2 py-2" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
                          <Text className="text-xs font-bold" style={{ color: "#E8D4B0" }}>KES {Number(region.commission_kes).toLocaleString()}</Text>
                          <Text style={{ fontSize: 9, color: "#C4DAC0" }}>commission</Text>
                        </View>
                        <View className="flex-1 rounded-xl px-2 py-2" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
                          <Text className="text-xs font-bold" style={{ color: Number(region.dormant_count) > 0 ? "#CC8830" : "#E8D4B0" }}>{Number(region.dormant_count)}</Text>
                          <Text style={{ fontSize: 9, color: "#C4DAC0" }}>dormant</Text>
                        </View>
                      </View>
                      {Number(region.open_escalations) > 0 && (
                        <Pressable onPress={() => selectTab("escalations")} className="w-full flex-row items-center gap-2 px-3 py-2 rounded-xl mt-2" style={{ backgroundColor: "rgba(184,80,56,0.22)" }}>
                          <AlertTriangle size={12} color="#B85038" />
                          <Text style={{ fontSize: 11, color: "#B85038", fontWeight: "600" }}>{region.open_escalations} open issue{Number(region.open_escalations) > 1 ? "s" : ""} — tap to review</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {tab === "activators" && (
            <>
              <Text className="text-xs font-semibold" style={{ color: "#3C6A4A" }}>{activators.length} activator{activators.length === 1 ? "" : "s"}</Text>
              {loading ? (
                <View className="py-8 items-center"><ActivityIndicator color="#1D3C2A" /></View>
              ) : activators.length === 0 ? (
                <View className="rounded-2xl px-4 py-8 items-center" style={{ backgroundColor: "#2E5A3E", gap: 8 }}>
                  <Users size={24} color="#96B496" />
                  <Text className="text-xs" style={{ color: "#96B496" }}>No activators assigned yet</Text>
                </View>
              ) : (
                [...activators].sort((a, b) => Number(b.commission_kes) - Number(a.commission_kes)).map((act) => (
                  <Pressable key={act.id} onPress={() => openDrill(act.id)} className="w-full rounded-2xl overflow-hidden active:scale-[0.98]" style={{ backgroundColor: "#2E5A3E", opacity: act.status === "active" ? 1 : 0.5 }}>
                    <View className="flex-row items-center gap-3 px-4 py-3.5">
                      <View className="w-10 h-10 rounded-xl items-center justify-center shrink-0" style={{ backgroundColor: "rgba(196,92,56,0.28)" }}>
                        <Text className="font-bold text-xs" style={{ color: "#C45C38" }}>{initials(act.name)}</Text>
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text numberOfLines={1} className="text-sm font-bold" style={{ color: "#E8D4B0" }}>{act.name} <Text style={{ fontSize: 10, color: "#96B496", fontWeight: "400" }}>· {act.code}</Text></Text>
                        <Text className="text-[10px]" style={{ color: "#C4DAC0" }}>
                          {!!act.territory && `${act.territory} · `}{act.paid_sessions} sessions
                          {Number(act.dormant_count) > 0 && <Text style={{ color: "#C07860" }}> · {act.dormant_count} dormant</Text>}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 shrink-0">
                        <View className="items-end">
                          <Text className="text-sm font-bold" style={{ color: "#C45C38" }}>KES {Number(act.commission_kes).toLocaleString()}</Text>
                          <Text style={{ fontSize: 9, color: "#96B496" }}>{act.status}</Text>
                        </View>
                        <ChevronRight size={14} color="#96B496" />
                      </View>
                    </View>
                  </Pressable>
                ))
              )}
            </>
          )}

          {tab === "escalations" && (
            <>
              <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E", borderWidth: 1, borderColor: "rgba(196,92,56,0.35)" }}>
                <Pressable className="w-full flex-row items-center justify-between px-4 py-3.5" onPress={() => setComposing((c) => !c)}>
                  <View className="flex-row items-center gap-2">
                    <Send size={14} color="#C45C38" />
                    <Text className="text-xs font-bold" style={{ color: "#E8D4B0" }}>Raise an Issue</Text>
                  </View>
                  <ChevronDown size={14} color="#C4DAC0" style={{ transform: [{ rotate: composing ? "180deg" : "0deg" }] }} />
                </Pressable>
                {composing && (
                  <View className="px-4 pb-4">
                    <TextInput
                      value={composeText}
                      onChangeText={setComposeText}
                      placeholder="Describe the issue clearly — include AP IDs, affected users, and steps already tried…"
                      placeholderTextColor="#7A9E7A"
                      multiline
                      className="w-full rounded-xl px-3 py-2 text-xs"
                      style={{ backgroundColor: "rgba(0,0,0,0.2)", height: 80, color: "#E8D4B0", textAlignVertical: "top" }}
                    />
                    <View className="flex-row rounded-xl overflow-hidden mt-2" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
                      {(["low", "medium", "high"] as const).map((p) => (
                        <Pressable
                          key={p}
                          onPress={() => setComposePriority(p)}
                          className="flex-1 py-1.5 items-center"
                          style={{ backgroundColor: composePriority === p ? (p === "high" ? "#B85038" : p === "medium" ? "#CC8830" : "#3C6A4A") : "transparent" }}
                        >
                          <Text className="font-bold capitalize" style={{ fontSize: 9, color: composePriority === p ? "#fff" : "#96B496" }}>{p}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable
                      onPress={submitEscalation}
                      disabled={!composeText.trim() || composeSubmitting}
                      className="mt-2 w-full py-2.5 rounded-xl flex-row items-center justify-center gap-2"
                      style={{ backgroundColor: composeText.trim() ? "#C45C38" : "rgba(255,255,255,0.1)" }}
                    >
                      {composeSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Send size={12} color={composeText.trim() ? "#fff" : "#96B496"} />}
                      <Text className="text-xs font-bold" style={{ color: composeText.trim() ? "#fff" : "#96B496" }}>Submit</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {loading ? (
                <View className="py-8 items-center"><ActivityIndicator color="#1D3C2A" /></View>
              ) : (
                <>
                  {escalations.length === 0 && (
                    <View className="rounded-2xl px-4 py-8 items-center" style={{ backgroundColor: "#2E5A3E", gap: 8 }}>
                      <ShieldCheck size={24} color="#96B496" />
                      <Text className="text-xs" style={{ color: "#96B496" }}>No issues raised yet</Text>
                    </View>
                  )}

                  {(() => {
                    const open = escalations.filter((e) => e.status !== "resolved");
                    const resolved = escalations.filter((e) => e.status === "resolved");
                    return (
                      <>
                        {open.length > 0 && <Text className="text-xs font-semibold" style={{ color: "#3C6A4A" }}>Open · {openEscs.length} action needed</Text>}
                        {open.map((esc) => {
                          const pc = ESC_PRIORITY_COLOR[esc.priority];
                          return (
                            <View key={esc.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E", borderWidth: 1, borderColor: `${pc}30` }}>
                              <View className="px-4 pt-4 pb-3">
                                <View className="flex-row items-center gap-2 mb-1">
                                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${pc}18` }}>
                                    <Text className="font-bold capitalize" style={{ fontSize: 9, color: pc }}>{esc.priority}</Text>
                                  </View>
                                  {esc.status === "escalated" && (
                                    <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(204,136,48,0.15)" }}>
                                      <Text className="font-bold" style={{ fontSize: 9, color: "#CC8830" }}>↑ Sent to Central</Text>
                                    </View>
                                  )}
                                </View>
                                <Text className="text-xs font-semibold" style={{ color: "#E8D4B0" }}>{esc.issue}</Text>
                                <Text className="text-[10px] mt-0.5" style={{ color: "#C4DAC0" }}>From {esc.activator_name ?? "You"} · {timeAgo(esc.created_at)}</Text>
                                {esc.status === "open" && (
                                  <View className="flex-row gap-2 mt-2">
                                    <Pressable onPress={() => setEscalationStatus(esc.id, "resolved")} className="flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1" style={{ backgroundColor: "rgba(78,128,80,0.30)" }}>
                                      <CheckCircle2 size={11} color="#4E8050" />
                                      <Text className="font-bold" style={{ fontSize: 10, color: "#4E8050" }}>Resolve</Text>
                                    </Pressable>
                                    <Pressable onPress={() => setEscalationStatus(esc.id, "escalated")} className="flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1" style={{ backgroundColor: "rgba(184,80,56,0.32)" }}>
                                      <Send size={11} color="#B85038" />
                                      <Text className="font-bold" style={{ fontSize: 10, color: "#B85038" }}>Escalate ↑</Text>
                                    </Pressable>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        })}

                        {resolved.length > 0 && <Text className="text-xs font-semibold" style={{ color: "#3C6A4A", marginTop: 4 }}>Resolved</Text>}
                        {resolved.map((esc) => (
                          <View key={esc.id} className="rounded-2xl px-4 py-3 flex-row items-center gap-3" style={{ backgroundColor: "#2E5A3E", opacity: 0.6 }}>
                            <CheckCircle2 size={16} color="#4E8050" />
                            <View className="flex-1 min-w-0">
                              <Text numberOfLines={1} className="text-xs font-medium" style={{ color: "#E8D4B0" }}>{esc.issue}</Text>
                              <Text className="text-[10px]" style={{ color: "#C4DAC0" }}>From {esc.activator_name ?? "You"} · {timeAgo(esc.created_at)}</Text>
                            </View>
                          </View>
                        ))}
                      </>
                    );
                  })()}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
