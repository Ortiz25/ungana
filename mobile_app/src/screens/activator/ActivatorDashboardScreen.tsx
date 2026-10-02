// Ported from frontend/src/lib/screens/ActivatorDashboardScreen.svelte —
// real-mode (isReal) branches only; the offline/demo-fallback half of that
// file (MOCK_ROSTER, fake payout ledger, editable goal-vs-target bars) is
// deliberately not ported — see the plan doc. Reads ActivatorAuthContext
// directly (same "screen reads its own subtree context" convention as
// CoordinatorsScreen.tsx) rather than taking token/activator as props.
import { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator, Modal, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import {
  MapPin, LogOut, TrendingUp, BarChart2, UserCheck, Wallet, User as UserIcon, CreditCard, Copy,
  Smartphone, ChevronLeft, ChevronRight, Filter, RefreshCw, X, Bell, Edit3, CheckCircle2, ArrowUpRight,
} from "lucide-react-native";
import { useActivatorAuth } from "@/flow/ActivatorAuthContext";
import {
  getActivatorSessions,
  getActivatorEarnings,
  getActivatorEarningsSeries,
  updateActivatorGoals,
  getActivatorNotifications,
  markActivatorNotificationsRead,
  updateActivatorNotificationPrefs,
  type ActivatorSession,
  type ActivatorEarnings,
  type ActivatorNotification,
  type ActivatorNotificationPrefs,
} from "@/lib/activatorApi";
import AreaChartMini from "@/components/AreaChartMini";
import BarChartMini from "@/components/BarChartMini";

const AVATAR_COLORS = ["#C45C38", "#4E8050", "#2E5A3E", "#CC8830", "#5B8ED6", "#9B6DD6", "#B85038", "#C06080"];
const SESSION_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "expired", label: "Expired" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
];
const SESSION_PAGE_SIZES = [5, 10, 20, 50, 100];
const NOTIF_PAGE_SIZES = [10, 20, 50];
const NOTIF_DROPDOWN_SIZE = 5;
const PERIODS = [
  { id: "7D", label: "This Week" },
  { id: "30D", label: "30 Days" },
  { id: "3M", label: "3 Months" },
  { id: "1Y", label: "1 Year" },
];
const TABS = [
  { id: "overview", label: "Home", Icon: TrendingUp },
  { id: "earnings", label: "Earn", Icon: BarChart2 },
  { id: "sessions", label: "Sessions", Icon: UserCheck },
  { id: "payouts", label: "Pay", Icon: Wallet },
  { id: "profile", label: "Profile", Icon: UserIcon },
] as const;
type TabId = (typeof TABS)[number]["id"];
type Period = (typeof PERIODS)[number]["id"];

function sessionStatus(s: ActivatorSession): string {
  if (s.payment_status !== "success") return s.payment_status;
  return s.expires_at && new Date(s.expires_at).getTime() > Date.now() ? "active" : "expired";
}
function sessionRef(s: ActivatorSession): string {
  return `#${String(s.id).replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
function sessionLabel(s: ActivatorSession): string {
  return s.client_username || sessionRef(s);
}
function formatDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
function formatShortDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
}
function formatNotifTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function ActivatorDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { activator, token, logout, updateProfile } = useActivatorAuth();

  const [sessions, setSessions] = useState<ActivatorSession[]>([]);
  const [earnings, setEarnings] = useState<ActivatorEarnings | null>(null);
  const [dailySeries, setDailySeries] = useState<{ date: string; commissionKes: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [notifications, setNotifications] = useState<ActivatorNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifTotal, setNotifTotal] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [allNotifications, setAllNotifications] = useState<ActivatorNotification[]>([]);
  const [notifListLoading, setNotifListLoading] = useState(false);
  const [notifPage, setNotifPage] = useState(1);
  const [notifPageSize, setNotifPageSize] = useState(10);

  const [tab, setTab] = useState<TabId>("overview");
  const [period, setPeriod] = useState<Period>("7D");

  const [sessionsFilter, setSessionsFilter] = useState("all");
  const [sessionsPageSize, setSessionsPageSize] = useState(10);
  const [sessionsPage, setSessionsPage] = useState(1);

  const [editingGoal, setEditingGoal] = useState<"daily" | "weekly" | null>(null);
  const [goalInput, setGoalInput] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);

  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [notifSaving, setNotifSaving] = useState<keyof ActivatorNotificationPrefs | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      const [sessionsResult, earningsResult, seriesResult, notificationsResult] = await Promise.all([
        getActivatorSessions(token!),
        getActivatorEarnings(token!),
        getActivatorEarningsSeries(token!, 365),
        getActivatorNotifications(token!, { pageSize: NOTIF_DROPDOWN_SIZE }),
      ]);
      if ([sessionsResult, earningsResult, seriesResult, notificationsResult].some((r) => "status" in r && r.status === 401)) {
        await logout();
        return;
      }
      if (sessionsResult.ok) setSessions(sessionsResult.data?.sessions ?? []);
      if (earningsResult.ok) setEarnings(earningsResult.data?.earnings ?? null);
      if (seriesResult.ok) setDailySeries(seriesResult.data?.series ?? []);
      if (notificationsResult.ok) {
        setNotifications(notificationsResult.data?.notifications ?? []);
        setUnreadCount(notificationsResult.data?.unreadCount ?? 0);
        setNotifTotal(notificationsResult.data?.total ?? 0);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [token, logout]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sessionsResult, earningsResult, seriesResult, notificationsResult] = await Promise.all([
        getActivatorSessions(token!),
        getActivatorEarnings(token!),
        getActivatorEarningsSeries(token!, 365),
        getActivatorNotifications(token!, { pageSize: NOTIF_DROPDOWN_SIZE }),
      ]);
      if (cancelled) return;
      if ([sessionsResult, earningsResult, seriesResult, notificationsResult].some((r) => "status" in r && r.status === 401)) {
        await logout();
        return;
      }
      if (sessionsResult.ok) setSessions(sessionsResult.data?.sessions ?? []);
      if (earningsResult.ok) setEarnings(earningsResult.data?.earnings ?? null);
      if (seriesResult.ok) setDailySeries(seriesResult.data?.series ?? []);
      if (notificationsResult.ok) {
        setNotifications(notificationsResult.data?.notifications ?? []);
        setUnreadCount(notificationsResult.data?.unreadCount ?? 0);
        setNotifTotal(notificationsResult.data?.total ?? 0);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grossKes = Number(earnings?.gross_kes ?? 0);
  const commissionKes = Number(earnings?.commission_kes ?? 0);
  const paidSessions = Number(earnings?.paid_sessions ?? 0);
  const uniqueDevices = useMemo(() => new Set(sessions.map((s) => s.client_mac)).size, [sessions]);
  const commissionRate = activator?.commissionRate != null ? Math.round(activator.commissionRate * 100) : 20;

  const daily = useMemo(
    () => dailySeries.map((d) => ({ label: formatDayLabel(d.date), shortLabel: formatShortDayLabel(d.date), earnings: d.commissionKes })),
    [dailySeries]
  );
  const monthlyData = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const d of dailySeries) {
      const monthKey = d.date.slice(0, 7);
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + d.commissionKes);
    }
    const months: { label: string; earnings: number }[] = [];
    const cursor = new Date();
    cursor.setUTCDate(1);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(cursor);
      d.setUTCMonth(d.getUTCMonth() - i);
      const key = d.toISOString().slice(0, 7);
      months.push({ label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), earnings: byMonth.get(key) ?? 0 });
    }
    return months;
  }, [dailySeries]);
  const chartData = useMemo(() => {
    if (period === "7D") return daily.slice(-7);
    if (period === "30D") return daily.slice(-30).filter((_, i) => i % 2 === 0);
    if (period === "3M") return daily.slice(-90).filter((_, i) => i % 7 === 0);
    return monthlyData;
  }, [period, daily, monthlyData]);
  const periodTotal = useMemo(() => {
    if (period === "1Y") return daily.reduce((s, d) => s + d.earnings, 0);
    const slice = period === "7D" ? daily.slice(-7) : period === "30D" ? daily.slice(-30) : daily.slice(-90);
    return slice.reduce((s, d) => s + d.earnings, 0);
  }, [period, daily]);
  const thisWeekTotal = useMemo(() => daily.slice(-7).reduce((s, d) => s + d.earnings, 0), [daily]);
  const thisMonthTotal = useMemo(() => daily.slice(-30).reduce((s, d) => s + d.earnings, 0), [daily]);

  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [sessions]);
  const filteredSessions = useMemo(
    () => (sessionsFilter === "all" ? sortedSessions : sortedSessions.filter((s) => sessionStatus(s) === sessionsFilter)),
    [sessionsFilter, sortedSessions]
  );
  const sessionsTotalPages = Math.max(1, Math.ceil(filteredSessions.length / sessionsPageSize));
  // Clamped at read time rather than corrected via an effect+setState — a
  // filter/page-size change can leave the stored sessionsPage out of range
  // for a tick, but there's no need to force it back in sync as separate
  // state; every render just displays/slices by the in-range value.
  const currentSessionsPage = Math.min(sessionsPage, sessionsTotalPages);
  const pagedSessions = useMemo(
    () => filteredSessions.slice((currentSessionsPage - 1) * sessionsPageSize, currentSessionsPage * sessionsPageSize),
    [filteredSessions, currentSessionsPage, sessionsPageSize]
  );

  function setFilter(id: string) {
    setSessionsFilter(id);
    setSessionsPage(1);
  }
  function setPageSize(size: number) {
    setSessionsPageSize(size);
    setSessionsPage(1);
  }

  async function openNotifications() {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next && unreadCount > 0) {
      const result = await markActivatorNotificationsRead(token!);
      if (result.ok) setUnreadCount(0);
    }
  }

  // Triggered directly from the event handlers that change notifPage/
  // notifPageSize/showAllNotifications below, rather than a useEffect keyed
  // on them — every one of those changes is already a direct user action
  // (opening the modal, tapping a page-size chip, tapping prev/next).
  async function loadNotificationsPage(page: number, pageSize: number) {
    setNotifListLoading(true);
    const result = await getActivatorNotifications(token!, { page, pageSize });
    if (result.ok) {
      setAllNotifications(result.data?.notifications ?? []);
      setNotifTotal(result.data?.total ?? 0);
    }
    setNotifListLoading(false);
  }

  async function openAllNotifications() {
    setShowNotifications(false);
    setShowAllNotifications(true);
    setNotifPage(1);
    loadNotificationsPage(1, notifPageSize);
    if (unreadCount > 0) {
      const result = await markActivatorNotificationsRead(token!);
      if (result.ok) setUnreadCount(0);
    }
  }
  function goToNotifPage(page: number) {
    setNotifPage(page);
    loadNotificationsPage(page, notifPageSize);
  }
  function selectNotifPageSize(size: number) {
    setNotifPageSize(size);
    setNotifPage(1);
    loadNotificationsPage(1, size);
  }
  const notifTotalPages = Math.max(1, Math.ceil(notifTotal / notifPageSize));

  async function toggleNotifPref(key: keyof ActivatorNotificationPrefs) {
    if (!activator) return;
    const next = !activator.notificationPrefs[key];
    setNotifSaving(key);
    const result = await updateActivatorNotificationPrefs(token!, { [key]: next });
    setNotifSaving(null);
    if (result.ok && result.data?.success) await updateProfile(result.data.activator);
  }

  async function handleSaveGoal() {
    const v = parseInt(goalInput.replace(/\D/g, ""), 10);
    if (!(v > 0) || !activator) {
      setEditingGoal(null);
      return;
    }
    const which = editingGoal;
    setGoalSaving(true);
    const result = await updateActivatorGoals(token!, {
      dailyTargetKes: which === "daily" ? v : activator.dailyTargetKes,
      weeklyTargetKes: which === "weekly" ? v : activator.weeklyTargetKes,
    });
    setGoalSaving(false);
    if (result.ok && result.data?.success) await updateProfile(result.data.activator);
    setEditingGoal(null);
  }

  async function copyLink() {
    await Clipboard.setStringAsync(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  if (!activator) return null;
  const displayName = activator.name.trim().split(/\s+/)[0] || activator.name;
  const inits = initials(activator.name);
  const inviteLink = `ungana.app/join?ref=${activator.code.toLowerCase().replace("-", "")}`;

  const statsStrip = [
    { label: "Paid Sessions", value: String(paidSessions), sub: "all-time" },
    { label: "Devices", value: String(uniqueDevices), sub: "unique clients" },
    { label: "Commission", value: `KES ${commissionKes.toLocaleString()}`, sub: "all-time" },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: "#E8D4B0" }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1D3C2A" />}>
        {/* Header */}
        <View className="px-5" style={{ paddingTop: insets.top + 16, paddingBottom: 56, backgroundColor: "#1D3C2A" }}>
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-2xl items-center justify-center shrink-0 font-bold text-sm" style={{ backgroundColor: avatarColor }}>
                <Text className="font-bold text-sm" style={{ color: "#fff" }}>{inits}</Text>
              </View>
              <View>
                <Text className="text-[9px] font-semibold uppercase" style={{ color: "#C4DAC0", letterSpacing: 1 }}>Activator · {activator.code}</Text>
                <Text className="text-sm font-bold font-serif" style={{ color: "#E8D4B0" }}>{displayName}</Text>
                {!!activator.territory && (
                  <Text className="text-[10px] flex-row items-center gap-1" style={{ color: "#AECAAE" }}><MapPin size={9} /> {activator.territory}</Text>
                )}
              </View>
            </View>
            <View className="flex-row items-center gap-2">
              <View style={{ position: "relative" }}>
                <Pressable onPress={openNotifications} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>
                  <Bell size={14} color="#C4DAC0" />
                  {unreadCount > 0 && (
                    <View className="absolute items-center justify-center" style={{ top: -2, right: -2, minWidth: 15, height: 15, paddingHorizontal: 2, borderRadius: 8, backgroundColor: "#C45C38" }}>
                      <Text className="font-bold" style={{ fontSize: 9, color: "#fff" }}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                    </View>
                  )}
                </Pressable>
                {showNotifications && (
                  <View className="absolute rounded-2xl overflow-hidden" style={{ right: 0, top: 40, width: 280, backgroundColor: "#2E5A3E", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", maxHeight: 320, zIndex: 50 }}>
                    <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
                      <Text className="text-xs font-bold" style={{ color: "#E8D4B0" }}>Notifications</Text>
                    </View>
                    <ScrollView style={{ maxHeight: 260 }}>
                      {notifications.length === 0 ? (
                        <Text className="text-[11px] text-center py-6 px-4" style={{ color: "#96B496" }}>Nothing yet — we&apos;ll let you know when something needs attention.</Text>
                      ) : (
                        notifications.map((n, i) => (
                          <View key={n.id} className="px-4 py-3" style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.08)" }}>
                            <Text className="text-[12px] font-semibold" style={{ color: "#E8D4B0" }}>{n.title}</Text>
                            {!!n.body && <Text className="text-[11px] mt-0.5" style={{ color: "#AECAAE" }}>{n.body}</Text>}
                            <Text className="text-[10px] mt-1" style={{ color: "#7A9E7A" }}>{formatNotifTime(n.created_at)}</Text>
                          </View>
                        ))
                      )}
                    </ScrollView>
                    {notifTotal > notifications.length && (
                      <Pressable onPress={openAllNotifications} className="w-full py-2.5 items-center" style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
                        <Text className="text-[11px] font-bold" style={{ color: "#C45C38" }}>View all {notifTotal} →</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
              <Pressable onPress={() => load(true)} disabled={refreshing} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.18)", opacity: refreshing ? 0.6 : 1 }}>
                <RefreshCw size={14} color="#C4DAC0" />
              </Pressable>
              <Pressable onPress={() => setTab("profile")} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>
                <Edit3 size={14} color="#C4DAC0" />
              </Pressable>
              <Pressable onPress={logout} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>
                <LogOut size={14} color="#C4DAC0" />
              </Pressable>
            </View>
          </View>

          <Text className="text-xs uppercase font-semibold mb-1" style={{ color: "#AECAAE", letterSpacing: 1 }}>Total lifetime earnings</Text>
          {loading ? (
            <View className="h-9 w-40 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.14)" }} />
          ) : (
            <Text className="font-bold" style={{ fontSize: 34, color: "#E8D4B0", letterSpacing: -1.5 }}>KES {commissionKes.toLocaleString()}</Text>
          )}
          <Text className="text-[10px] mt-2" style={{ color: "#AECAAE" }}>{commissionRate}% commission rate</Text>
        </View>

        {/* Floating stats strip */}
        <View className="mx-4 rounded-3xl overflow-hidden flex-row" style={{ marginTop: -40, backgroundColor: "#162C1E" }}>
          {statsStrip.map((s, i) => (
            <View key={s.label} className="flex-1 items-center py-4 px-2" style={{ borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: "rgba(255,255,255,0.18)" }}>
              <Text className="font-bold" style={{ fontSize: 16, color: "#C45C38" }}>{s.value}</Text>
              <Text className="text-center mt-0.5" style={{ fontSize: 9, color: "#C4DAC0", textTransform: "uppercase" }}>{s.label}</Text>
              <Text className="text-center mt-0.5" style={{ fontSize: 9, color: "#96B496" }}>{s.sub}</Text>
            </View>
          ))}
        </View>

        {/* Tab bar */}
        <View className="flex-row mx-4 mt-4 mb-4 rounded-2xl overflow-hidden p-1" style={{ backgroundColor: "rgba(46,90,62,0.12)", gap: 2 }}>
          {TABS.map((t) => (
            <Pressable key={t.id} onPress={() => setTab(t.id)} className="flex-1 py-2 rounded-xl items-center" style={{ backgroundColor: tab === t.id ? "#2E5A3E" : "transparent", gap: 2 }}>
              <t.Icon size={14} color={tab === t.id ? avatarColor : "#3C6A4A"} />
              <Text className="font-bold" style={{ fontSize: 9, color: tab === t.id ? "#E8D4B0" : "#3C6A4A" }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <View className="px-4 pb-10" style={{ gap: 12 }}>
          {tab === "overview" && (
            <>
              <View className="rounded-3xl px-5 pt-4 pb-4" style={{ backgroundColor: "#2E5A3E" }}>
                <Text className="text-[10px] uppercase font-semibold mb-1" style={{ color: "#C4DAC0", letterSpacing: 1 }}>All-time commission</Text>
                <Text className="font-serif font-bold" style={{ fontSize: 22, color: "#E8D4B0" }}>KES {commissionKes.toLocaleString()}</Text>
                <Text className="text-[10px] mt-1" style={{ color: "#96B496" }}>from KES {grossKes.toLocaleString()} in referred purchases · {paidSessions} paid sessions</Text>
              </View>

              <View className="rounded-3xl overflow-hidden" style={{ backgroundColor: "#2E5A3E" }}>
                <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase" style={{ color: "#C4DAC0", letterSpacing: 0.5 }}>Recent Sessions</Text>
                  {sortedSessions.length > 5 && (
                    <Pressable onPress={() => setTab("sessions")}>
                      <Text className="text-[10px] font-bold" style={{ color: "#C45C38" }}>View all →</Text>
                    </Pressable>
                  )}
                </View>
                {loading ? (
                  <View className="px-4 pb-4"><ActivityIndicator color="rgba(255,255,255,0.7)" /></View>
                ) : sortedSessions.length === 0 ? (
                  <Text className="text-xs px-4 pb-4" style={{ color: "#96B496" }}>No sessions referred yet.</Text>
                ) : (
                  sortedSessions.slice(0, 5).map((s, i) => (
                    <View key={s.id} className="flex-row items-center gap-3 px-4 py-3" style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.14)" }}>
                      <View className="w-8 h-8 rounded-xl items-center justify-center shrink-0" style={{ backgroundColor: "rgba(196,92,56,0.30)" }}>
                        <Smartphone size={13} color="#C45C38" />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text numberOfLines={1} className="text-xs font-semibold" style={{ color: "#E8D4B0" }}>{sessionLabel(s)} · {s.package_id}</Text>
                        <Text className="text-[10px]" style={{ color: "#AECAAE" }}>{new Date(s.created_at).toLocaleDateString()} · {sessionStatus(s)}</Text>
                      </View>
                      <Text className="text-xs font-bold shrink-0" style={{ color: "#C45C38" }}>+KES {Number(s.commission_kes).toLocaleString()}</Text>
                    </View>
                  ))
                )}
                <View style={{ height: 12 }} />
              </View>
            </>
          )}

          {tab === "earnings" && (
            loading ? (
              <View className="py-8 items-center"><ActivityIndicator color="#1D3C2A" /></View>
            ) : (
              <>
                <View className="flex-row" style={{ gap: 8 }}>
                  <View className="flex-1 rounded-2xl px-3 py-3" style={{ backgroundColor: "#2E5A3E" }}>
                    <Text className="uppercase" style={{ fontSize: 9, color: "#96B496" }}>This Week</Text>
                    <Text numberOfLines={1} className="font-bold mt-0.5" style={{ fontSize: 13, color: "#E8D4B0" }}>KES {thisWeekTotal.toLocaleString()}</Text>
                  </View>
                  <View className="flex-1 rounded-2xl px-3 py-3" style={{ backgroundColor: "#2E5A3E" }}>
                    <Text className="uppercase" style={{ fontSize: 9, color: "#96B496" }}>This Month</Text>
                    <Text numberOfLines={1} className="font-bold mt-0.5" style={{ fontSize: 13, color: "#E8D4B0" }}>KES {thisMonthTotal.toLocaleString()}</Text>
                  </View>
                  <View className="flex-1 rounded-2xl px-3 py-3" style={{ backgroundColor: "#2E5A3E" }}>
                    <Text className="uppercase" style={{ fontSize: 9, color: "#96B496" }}>All Time</Text>
                    <Text numberOfLines={1} className="font-bold mt-0.5" style={{ fontSize: 13, color: "#C45C38" }}>KES {commissionKes.toLocaleString()}</Text>
                  </View>
                </View>

                <View className="flex-row rounded-2xl overflow-hidden p-1" style={{ backgroundColor: "rgba(46,90,62,0.12)", gap: 2 }}>
                  {PERIODS.map((p) => (
                    <Pressable key={p.id} onPress={() => setPeriod(p.id)} className="flex-1 py-2 rounded-xl items-center" style={{ backgroundColor: period === p.id ? "#2E5A3E" : "transparent" }}>
                      <Text className="font-bold" style={{ fontSize: 11, color: period === p.id ? "#C45C38" : "#3C6A4A" }}>{p.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <View className="rounded-3xl px-5 py-5" style={{ backgroundColor: "#2E5A3E" }}>
                  <Text className="uppercase font-semibold mb-1" style={{ fontSize: 10, color: "#AECAAE", letterSpacing: 1 }}>
                    {period === "7D" ? "This Week" : period === "30D" ? "Last 30 Days" : period === "3M" ? "Last 3 Months" : "This Year"}
                  </Text>
                  <Text className="font-bold" style={{ fontSize: 28, color: "#E8D4B0", letterSpacing: -1 }}>KES {periodTotal.toLocaleString()}</Text>
                  <Text className="text-xs mt-1" style={{ color: "#C4DAC0" }}>at {commissionRate}% commission rate</Text>
                  <View style={{ height: 140, marginTop: 16 }}>
                    <AreaChartMini data={chartData} yKey="earnings" xKey={period === "1Y" ? "label" : "shortLabel"} height={140} color="#C45C38" showGrid showYLabels />
                  </View>
                </View>

                <View className="rounded-3xl overflow-hidden" style={{ backgroundColor: "#2E5A3E" }}>
                  <View className="px-4 pt-4 pb-2">
                    <Text className="text-xs font-bold uppercase" style={{ color: "#C4DAC0", letterSpacing: 0.5 }}>Monthly comparison</Text>
                  </View>
                  <View style={{ height: 140 }}>
                    <BarChartMini data={monthlyData} yKey="earnings" xKey="label" barSize={16} radius={4} height={140} color="#C45C38" opacity={0.85} showYLabels />
                  </View>
                  <View style={{ height: 12 }} />
                </View>

                <View className="rounded-3xl px-5 py-4" style={{ backgroundColor: "#2E5A3E" }}>
                  <Text className="text-xs font-bold uppercase mb-3" style={{ color: "#C4DAC0", letterSpacing: 0.5 }}>All-time breakdown</Text>
                  {[
                    { label: "Gross referred purchases", value: `KES ${grossKes.toLocaleString()}`, highlight: false },
                    { label: `Your commission (${commissionRate}%)`, value: `KES ${commissionKes.toLocaleString()}`, highlight: true },
                    { label: "Paid sessions", value: String(paidSessions), highlight: false },
                  ].map((row, i, arr) => (
                    <View key={row.label} className="flex-row justify-between items-center py-2.5" style={{ borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.14)" }}>
                      <Text className="text-xs" style={{ color: "#C4DAC0" }}>{row.label}</Text>
                      <Text className="text-sm font-bold" style={{ color: row.highlight ? "#C45C38" : "#E8D4B0" }}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              </>
            )
          )}

          {tab === "sessions" && (
            <>
              <Text className="text-xs font-semibold" style={{ color: "#3C6A4A" }}>
                {filteredSessions.length} session{filteredSessions.length === 1 ? "" : "s"} · {uniqueDevices} unique device{uniqueDevices === 1 ? "" : "s"}
              </Text>
              {loading ? (
                <View className="py-8 items-center"><ActivityIndicator color="#1D3C2A" /></View>
              ) : sessions.length === 0 ? (
                <View className="rounded-2xl px-4 py-8 items-center" style={{ backgroundColor: "rgba(46,90,62,0.08)", gap: 8 }}>
                  <UserCheck size={24} color="#96B496" />
                  <Text className="text-xs" style={{ color: "#96B496" }}>No sessions referred yet</Text>
                </View>
              ) : (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: "center" }}>
                    <Filter size={12} color="#3C6A4A" />
                    {SESSION_FILTERS.map((f) => (
                      <Pressable key={f.id} onPress={() => setFilter(f.id)} className="px-3 py-1.5 rounded-full" style={{ backgroundColor: sessionsFilter === f.id ? "#2E5A3E" : "rgba(46,90,62,0.1)" }}>
                        <Text className="font-bold" style={{ fontSize: 11, color: sessionsFilter === f.id ? "#E8D4B0" : "#3C6A4A" }}>{f.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {filteredSessions.length === 0 ? (
                    <View className="rounded-2xl px-4 py-8 items-center" style={{ backgroundColor: "rgba(46,90,62,0.08)" }}>
                      <Text className="text-xs" style={{ color: "#96B496" }}>No sessions match this filter.</Text>
                    </View>
                  ) : (
                    <>
                      {pagedSessions.map((s) => {
                        const status = sessionStatus(s);
                        const statusColor = status === "active" ? "#4E8050" : status === "expired" ? "#96B496" : status === "failed" ? "#B85038" : "#CC8830";
                        const statusBg = status === "active" ? "rgba(78,128,80,0.30)" : status === "expired" ? "rgba(255,255,255,0.1)" : status === "failed" ? "rgba(192,97,74,0.2)" : "rgba(204,136,48,0.25)";
                        return (
                          <View key={s.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E" }}>
                            <View className="flex-row items-center gap-3 px-4 py-3.5">
                              <View className="w-9 h-9 rounded-xl items-center justify-center shrink-0" style={{ backgroundColor: "rgba(196,92,56,0.28)" }}>
                                <Smartphone size={15} color="#C45C38" />
                              </View>
                              <View className="flex-1 min-w-0">
                                <Text numberOfLines={1} className="text-sm font-semibold" style={{ color: "#E8D4B0" }}>{sessionLabel(s)} · {s.package_id}</Text>
                                <Text className="text-[10px]" style={{ color: "#AECAAE" }}>{new Date(s.created_at).toLocaleDateString()}</Text>
                              </View>
                              <View className="items-end shrink-0" style={{ gap: 4 }}>
                                <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: statusBg }}>
                                  <Text className="font-semibold capitalize" style={{ fontSize: 10, color: statusColor }}>{status}</Text>
                                </View>
                                <Text className="font-bold" style={{ fontSize: 10, color: "#C45C38" }}>+KES {Number(s.commission_kes).toLocaleString()}</Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}

                      <View className="flex-row items-center justify-between pt-1">
                        <View className="flex-row items-center" style={{ gap: 6 }}>
                          <Text style={{ fontSize: 10, color: "#3C6A4A" }}>Show</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                            {SESSION_PAGE_SIZES.map((size) => (
                              <Pressable key={size} onPress={() => setPageSize(size)} className="px-2 py-1 rounded-lg" style={{ backgroundColor: sessionsPageSize === size ? "#2E5A3E" : "rgba(46,90,62,0.1)" }}>
                                <Text className="font-bold" style={{ fontSize: 11, color: sessionsPageSize === size ? "#E8D4B0" : "#1D3C2A" }}>{size}</Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Pressable onPress={() => setSessionsPage(Math.max(1, currentSessionsPage - 1))} disabled={currentSessionsPage <= 1} className="w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(46,90,62,0.1)", opacity: currentSessionsPage <= 1 ? 0.4 : 1 }}>
                            <ChevronLeft size={13} color="#1D3C2A" />
                          </Pressable>
                          <Text className="font-semibold" style={{ fontSize: 11, color: "#1D3C2A" }}>Page {currentSessionsPage} of {sessionsTotalPages}</Text>
                          <Pressable onPress={() => setSessionsPage(Math.min(sessionsTotalPages, currentSessionsPage + 1))} disabled={currentSessionsPage >= sessionsTotalPages} className="w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(46,90,62,0.1)", opacity: currentSessionsPage >= sessionsTotalPages ? 0.4 : 1 }}>
                            <ChevronRight size={13} color="#1D3C2A" />
                          </Pressable>
                        </View>
                      </View>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {tab === "payouts" && (
            <View className="rounded-3xl px-5 py-5" style={{ backgroundColor: "#2E5A3E", borderWidth: 1, borderColor: "rgba(196,92,56,0.35)" }}>
              <View className="flex-row items-center gap-2 mb-3">
                <Wallet size={16} color="#C45C38" />
                <Text className="uppercase font-semibold" style={{ fontSize: 10, color: "#C4DAC0", letterSpacing: 1 }}>All-time commission earned</Text>
              </View>
              <Text className="font-bold" style={{ fontSize: 34, color: "#C45C38", letterSpacing: -1 }}>KES {commissionKes.toLocaleString()}</Text>
              <Text className="text-xs mt-1" style={{ color: "#AECAAE" }}>Payout tracking isn&apos;t wired up yet — talk to your coordinator about settlement.</Text>
            </View>
          )}

          {tab === "profile" && (
            <>
              <View className="rounded-3xl px-5 py-5 items-center" style={{ backgroundColor: "#2E5A3E", gap: 16 }}>
                <View className="w-20 h-20 rounded-3xl items-center justify-center" style={{ backgroundColor: avatarColor }}>
                  <Text className="font-bold" style={{ fontSize: 24, color: "#fff", letterSpacing: -0.5 }}>{inits}</Text>
                </View>
                <View>
                  <Text className="uppercase font-semibold text-center mb-2" style={{ fontSize: 10, color: "#C4DAC0", letterSpacing: 1 }}>Avatar colour</Text>
                  <View className="flex-row" style={{ gap: 8 }}>
                    {AVATAR_COLORS.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setAvatarColor(c)}
                        className="rounded-full"
                        style={{
                          width: 28, height: 28, backgroundColor: c,
                          transform: [{ scale: avatarColor === c ? 1.25 : 1 }],
                          borderWidth: avatarColor === c ? 2 : 0, borderColor: "#2E5A3E",
                        }}
                      />
                    ))}
                  </View>
                </View>
              </View>

              <View className="rounded-3xl overflow-hidden" style={{ backgroundColor: "#2E5A3E" }}>
                <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase" style={{ color: "#C4DAC0", letterSpacing: 0.5 }}>Your details</Text>
                  <Text style={{ fontSize: 10, color: "#7A9E7A" }}>Contact admin to change</Text>
                </View>
                {[
                  { Icon: UserIcon, label: "Full name", value: activator.name },
                  { Icon: MapPin, label: "Territory", value: activator.territory },
                  { Icon: CreditCard, label: "M-PESA number", value: activator.mpesaNumber },
                ].map((f, i) => (
                  <View key={f.label} className="flex-row items-start gap-3 px-5 py-3.5" style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.14)" }}>
                    <View style={{ marginTop: 2 }}><f.Icon size={14} color={avatarColor} /></View>
                    <View className="flex-1 min-w-0">
                      <Text className="uppercase font-semibold mb-0.5" style={{ fontSize: 10, color: "#AECAAE", letterSpacing: 0.5 }}>{f.label}</Text>
                      <Text className="text-sm font-semibold" style={{ color: f.value ? "#E8D4B0" : "#4A6842" }}>{f.value || "—"}</Text>
                    </View>
                  </View>
                ))}
                <View className="flex-row items-center gap-3 px-5 py-3.5" style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.14)" }}>
                  <UserCheck size={14} color={avatarColor} />
                  <View>
                    <Text className="uppercase font-semibold mb-0.5" style={{ fontSize: 10, color: "#AECAAE", letterSpacing: 0.5 }}>Activator ID</Text>
                    <Text className="text-sm font-semibold" style={{ color: "#E8D4B0" }}>{activator.code}</Text>
                  </View>
                </View>
                <View style={{ height: 8 }} />
              </View>

              <View className="rounded-3xl overflow-hidden" style={{ backgroundColor: "#2E5A3E" }}>
                <View className="px-5 pt-4 pb-2">
                  <Text className="text-xs font-bold uppercase" style={{ color: "#C4DAC0", letterSpacing: 0.5 }}>Goal defaults</Text>
                </View>
                {([
                  { key: "daily" as const, label: "Daily target", target: activator.dailyTargetKes },
                  { key: "weekly" as const, label: "Weekly target", target: activator.weeklyTargetKes },
                ]).map((g, i) => (
                  <View key={g.key} style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.14)" }}>
                    <Pressable
                      onPress={() => {
                        setGoalInput(String(g.target));
                        setEditingGoal(editingGoal === g.key ? null : g.key);
                      }}
                      className="w-full flex-row items-center justify-between px-5 py-3.5"
                    >
                      <Text className="text-sm font-medium" style={{ color: "#E8D4B0" }}>{g.label}</Text>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-bold" style={{ color: avatarColor }}>KES {g.target.toLocaleString()}</Text>
                        {editingGoal === g.key ? <X size={12} color="#AECAAE" /> : <Edit3 size={12} color="#AECAAE" />}
                      </View>
                    </Pressable>
                    {editingGoal === g.key && (
                      <View className="flex-row items-center gap-2 px-5 pb-3.5">
                        <View className="flex-1 flex-row items-center gap-2 px-3 py-2 rounded-2xl" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
                          <Text className="text-xs" style={{ color: "#C4DAC0" }}>KES</Text>
                          <TextInput
                            value={goalInput}
                            onChangeText={setGoalInput}
                            keyboardType="number-pad"
                            className="flex-1 text-sm font-bold"
                            style={{ color: "#E8D4B0" }}
                          />
                        </View>
                        <Pressable onPress={handleSaveGoal} disabled={goalSaving} className="px-4 py-2 rounded-2xl" style={{ backgroundColor: "#C45C38", opacity: goalSaving ? 0.7 : 1 }}>
                          <Text className="text-xs font-bold" style={{ color: "#fff" }}>{goalSaving ? "Saving…" : "Save"}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))}
                <View style={{ height: 8 }} />
              </View>

              <View className="rounded-3xl overflow-hidden" style={{ backgroundColor: "#2E5A3E" }}>
                <View className="px-5 pt-4 pb-2">
                  <Text className="text-xs font-bold uppercase" style={{ color: "#C4DAC0", letterSpacing: 0.5 }}>Notifications</Text>
                </View>
                {([
                  { key: "expiring" as const, label: "Expiring users", sub: "Alert when a referred session is about to expire" },
                  { key: "dormant" as const, label: "Dormant users", sub: "Alert when a referred user goes quiet" },
                  { key: "goalMiss" as const, label: "Goal reminders", sub: "Alert when you're behind on a target" },
                  { key: "newPurchase" as const, label: "New purchases", sub: "Alert on every new referred purchase" },
                ]).map((row, i) => (
                  <View key={row.key} className="flex-row items-center justify-between px-5 py-3.5" style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.14)" }}>
                    <View className="flex-1 pr-3">
                      <Text className="text-sm font-medium" style={{ color: "#E8D4B0" }}>{row.label}</Text>
                      <Text className="text-[10px]" style={{ color: "#AECAAE" }}>{row.sub}</Text>
                    </View>
                    <Pressable
                      onPress={() => toggleNotifPref(row.key)}
                      disabled={notifSaving === row.key}
                      className="rounded-full shrink-0"
                      style={{ width: 44, height: 24, backgroundColor: activator.notificationPrefs[row.key] ? avatarColor : "rgba(255,255,255,0.12)", opacity: notifSaving === row.key ? 0.6 : 1 }}
                    >
                      <View className="rounded-full bg-white" style={{ position: "absolute", top: 2, width: 20, height: 20, left: activator.notificationPrefs[row.key] ? 22 : 2 }} />
                    </Pressable>
                  </View>
                ))}
                <View style={{ height: 8 }} />
              </View>

              <View className="rounded-3xl px-5 py-4" style={{ backgroundColor: "#2E5A3E" }}>
                <View className="flex-row items-center gap-2 mb-2">
                  <ArrowUpRight size={14} color={avatarColor} />
                  <Text className="text-xs font-bold uppercase" style={{ color: "#C4DAC0", letterSpacing: 0.5 }}>Your invite link</Text>
                </View>
                <View className="flex-row items-center gap-2 px-3 py-2.5 rounded-2xl mb-2" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
                  <Text numberOfLines={1} className="flex-1 text-xs" style={{ color: "#E8D4B0", fontFamily: "monospace" }}>{inviteLink}</Text>
                  <Pressable onPress={copyLink} className="flex-row items-center gap-1 px-2 py-1 rounded-lg shrink-0" style={{ backgroundColor: linkCopied ? "rgba(78,128,80,0.35)" : "rgba(196,92,56,0.30)" }}>
                    {linkCopied ? <CheckCircle2 size={10} color="#4E8050" /> : <Copy size={10} color="#C45C38" />}
                    <Text className="font-bold" style={{ fontSize: 10, color: linkCopied ? "#4E8050" : "#C45C38" }}>{linkCopied ? "Copied" : "Copy"}</Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 10, color: "#AECAAE" }}>Share to onboard new users. You earn {commissionRate}% on every purchase they make.</Text>
              </View>

              <Pressable onPress={logout} className="w-full py-3.5 rounded-2xl flex-row items-center justify-center gap-2" style={{ backgroundColor: "rgba(192,97,74,0.1)", borderWidth: 1, borderColor: "rgba(192,97,74,0.2)" }}>
                <LogOut size={15} color="#B85038" />
                <Text className="font-bold text-sm" style={{ color: "#B85038" }}>Sign out</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showAllNotifications} transparent animationType="fade" onRequestClose={() => setShowAllNotifications(false)}>
        <View className="flex-1 items-center justify-end" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
          <View className="w-full rounded-t-3xl" style={{ backgroundColor: "#1D3C2A", maxWidth: 480, maxHeight: "85%" }}>
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
              <Text className="text-sm font-bold" style={{ color: "#E8D4B0" }}>All notifications</Text>
              <Pressable onPress={() => setShowAllNotifications(false)} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <X size={14} color="#C4DAC0" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {notifListLoading ? (
                <View className="py-10 items-center"><ActivityIndicator color="rgba(255,255,255,0.7)" /></View>
              ) : allNotifications.length === 0 ? (
                <Text className="text-xs text-center py-10 px-5" style={{ color: "#96B496" }}>No notifications yet.</Text>
              ) : (
                allNotifications.map((n, i) => (
                  <View key={n.id} className="px-5 py-3.5" style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.08)" }}>
                    <Text className="text-xs font-semibold" style={{ color: "#E8D4B0" }}>{n.title}</Text>
                    {!!n.body && <Text className="text-[11px] mt-0.5" style={{ color: "#AECAAE" }}>{n.body}</Text>}
                    <Text className="text-[10px] mt-1" style={{ color: "#7A9E7A" }}>{formatNotifTime(n.created_at)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            {notifTotal > 0 && (
              <View className="flex-row items-center justify-between px-5 py-3" style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <Text style={{ fontSize: 10, color: "#96B496" }}>Show</Text>
                  {NOTIF_PAGE_SIZES.map((size) => (
                    <Pressable
                      key={size}
                      onPress={() => selectNotifPageSize(size)}
                      className="px-2 py-1 rounded-lg"
                      style={{ backgroundColor: notifPageSize === size ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.1)" }}
                    >
                      <Text className="font-bold" style={{ fontSize: 11, color: "#E8D4B0" }}>{size}</Text>
                    </Pressable>
                  ))}
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable onPress={() => goToNotifPage(Math.max(1, notifPage - 1))} disabled={notifPage <= 1} className="w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.1)", opacity: notifPage <= 1 ? 0.4 : 1 }}>
                    <ChevronLeft size={13} color="#C4DAC0" />
                  </Pressable>
                  <Text className="font-semibold" style={{ fontSize: 11, color: "#C4DAC0" }}>Page {notifPage} of {notifTotalPages}</Text>
                  <Pressable onPress={() => goToNotifPage(Math.min(notifTotalPages, notifPage + 1))} disabled={notifPage >= notifTotalPages} className="w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.1)", opacity: notifPage >= notifTotalPages ? 0.4 : 1 }}>
                    <ChevronRight size={13} color="#C4DAC0" />
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
