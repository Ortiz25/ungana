// Ported from frontend/src/lib/screens/PackageScreen.svelte, including its
// Activator/Coordinator/Admin staff-login footer pill. Only the Admin login
// flow is actually built in the mobile app so far (see the admin dashboard
// plan doc) — Activator/Coordinator screens are later-phase work, so those
// two buttons show a placeholder for now rather than navigating.
import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronRight, Clock, CheckCircle2, Zap, Pin, GraduationCap, Users, UserCheck, ShieldCheck, UserCircle2 } from "lucide-react-native";
import ScreenBg from "@/components/ScreenBg";
import UnganaLogoMark from "@/components/UnganaLogoMark";
import ActivatorDropdown from "@/components/ActivatorDropdown";
import ActiveSessionBanner from "@/components/ActiveSessionBanner";
import { PACKAGES, ACTIVATORS, type Package, type Activator } from "@/lib/data";
import { getPackages, getActivatorForMac, getSite, getCampusPosts, getCommunityPosts } from "@/lib/api";
import { getClientMac, getSiteId, hasKnownIdentity } from "@/lib/device";

const DISMISSED_NOTICES_KEY = "ungana_dismissed_notices";

type SiteInfo = { name?: string; mode?: string; vertical?: string } | null;
type PackageWithFeatured = Package & { isFeatured?: boolean };

function formatDuration(secs: number): string {
  if (secs >= 86400) {
    const days = Math.round(secs / 86400);
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (secs >= 3600) {
    const hours = Math.round(secs / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const mins = Math.max(1, Math.round(secs / 60));
  return `${mins} minute${mins === 1 ? "" : "s"}`;
}

export default function PackageScreen({
  mode = "simulation",
  onSelect,
  onEarnAccess,
  onCheckSession,
  onActivatorLogin,
  onCoordinatorLogin,
  onAdminLogin,
}: {
  mode?: "simulation" | "active";
  onSelect: (pkg: Package, activator: Activator) => void;
  onEarnAccess: () => void;
  // Returns to the by-username session lookup — for a guest who already
  // has a session (e.g. recovering it on a new/cleared device) rather than
  // one of the staff roles below.
  onCheckSession: () => void;
  onActivatorLogin: () => void;
  onCoordinatorLogin: () => void;
  onAdminLogin: () => void;
}) {
  const [packages, setPackages] = useState<PackageWithFeatured[]>(PACKAGES);
  const [siteMode, setSiteMode] = useState<string | null>(null);
  const [siteInfo, setSiteInfo] = useState<SiteInfo>(null);
  const isInstitution = siteInfo?.vertical === "institution";
  const isCommunity = siteInfo?.vertical === "community";

  const [urgentNotices, setUrgentNotices] = useState<{ id: number | string }[]>([]);

  const [selected, setSelected] = useState("weekly");
  const [activator, setActivator] = useState<Activator | null>(null);
  const [activatorError, setActivatorError] = useState(false);
  const [activatorLocked, setActivatorLocked] = useState(false);

  // Tapping the notification pin both opens the notices (via onEarnAccess,
  // same destination the old banner used) and marks the current batch seen,
  // so the badge count is accurate again next time this screen mounts —
  // there's no separate "X to dismiss" affordance anymore now that this is a
  // persistent icon rather than a one-off banner.
  async function openNotices() {
    try {
      const prior = JSON.parse((await AsyncStorage.getItem(DISMISSED_NOTICES_KEY)) || "[]");
      const ids = new Set([...prior, ...urgentNotices.map((n) => n.id)]);
      await AsyncStorage.setItem(DISMISSED_NOTICES_KEY, JSON.stringify([...ids]));
    } catch {
      // storage unavailable — the badge just won't remember it's been seen, no functional loss
    }
    onEarnAccess();
  }

  useEffect(() => {
    (async () => {
      const siteId = getSiteId();
      if (!siteId) setSiteMode("both");

      const [siteResult, packagesResult] = await Promise.all([siteId ? getSite(siteId) : Promise.resolve(null), getPackages(siteId)]);

      if (siteId) {
        const info = siteResult?.ok ? siteResult.data?.site ?? null : null;
        setSiteInfo(info);
        setSiteMode(info?.mode ?? "both");

        if (info?.vertical === "institution" || info?.vertical === "community") {
          const postsResult = info.vertical === "institution" ? await getCampusPosts(siteId) : await getCommunityPosts(siteId);
          const posts = postsResult.ok ? postsResult.data?.posts ?? [] : [];
          let dismissedIds: (number | string)[] = [];
          try {
            dismissedIds = JSON.parse((await AsyncStorage.getItem(DISMISSED_NOTICES_KEY)) || "[]");
          } catch {
            // corrupt/unavailable — treat as nothing dismissed yet
          }
          setUrgentNotices(posts.filter((p: any) => (p.is_pinned || p.priority === "urgent") && !dismissedIds.includes(p.id)));
        }
      }

      if (!packagesResult.ok || !packagesResult.data?.packages) return;

      const merged: PackageWithFeatured[] = packagesResult.data.packages.map((row: any) => {
        const local = PACKAGES.find((p) => p.id === row.id);
        if (local) {
          return {
            ...local,
            label: row.label,
            price: Number(row.price_kes),
            badge: row.badge ?? null,
            isFeatured: !!row.is_featured,
            demoSecs: mode === "active" ? row.duration_secs : local.demoSecs,
          };
        }
        return {
          id: row.id,
          label: row.label,
          duration: formatDuration(row.duration_secs),
          price: Number(row.price_kes),
          icon: Clock,
          badge: row.badge ?? null,
          isFeatured: !!row.is_featured,
          demoSecs: mode === "active" ? row.duration_secs : 45,
        };
      });

      if (merged.length > 0) {
        setPackages(merged);
        const featured = merged.find((p) => p.isFeatured);
        setSelected((prev) => (featured ?? merged.find((p) => p.id === prev) ?? merged[0]).id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasKnownIdentity()) return;
    (async () => {
      const result = await getActivatorForMac(getClientMac()!);
      if (!result.ok || !result.data?.locked) return;
      setActivatorLocked(true);
      setActivator(
        result.data.activator
          ? { id: result.data.activator.code, name: result.data.activator.name, area: result.data.activator.territory ?? "", sessions: 0 }
          : ACTIVATORS.find((a) => a.id === "SELF")!
      );
    })();
  }, []);

  // Earning needs a mac to track completions against — a device that
  // arrived with none (freshly logged out, or never deep-linked in via the
  // captive portal) can still buy a package (that flow is mac-tolerant, the
  // router attaches it once they connect) but would otherwise watch content
  // only to hit a dead end at the claim step. Computed once and reused by
  // both the Earn Free Access CTA below and the footer's User pill.
  const identityKnown = hasKnownIdentity();

  return (
    <ScreenBg scroll>
      <View className="w-full max-w-md mx-auto self-center flex-col" style={{ width: "100%" }}>
        <View className="items-center pt-8 pb-6" style={{ position: "relative" }}>
          {(isInstitution || isCommunity) && urgentNotices.length > 0 && (
            <View style={{ position: "absolute", top: 0, left: 0 }}>
              <Pressable
                onPress={openNotices}
                className="items-center justify-center active:scale-95"
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(196,92,56,0.14)", borderWidth: 1, borderColor: "rgba(196,92,56,0.3)" }}
              >
                <Pin size={17} color="#C45C38" fill="#C45C38" />
                <View
                  className="absolute items-center justify-center"
                  style={{ top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 3, borderRadius: 9, backgroundColor: "#C45C38", borderWidth: 2, borderColor: "#E8D4B0" }}
                >
                  <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>{urgentNotices.length > 9 ? "9+" : urgentNotices.length}</Text>
                </View>
              </Pressable>
            </View>
          )}
          <View style={{ position: "absolute", top: 0, right: 0 }}>
            <ActiveSessionBanner />
          </View>
          <UnganaLogoMark height={52} />
          <Text className="text-2xl font-serif mt-3 text-center" style={{ color: "#1D3C2A" }}>
            Ungana
          </Text>
          <Text className="text-xs font-sans-medium mt-0.5" style={{ color: "#2E5A3E" }}>
            {isInstitution ? "Campus WiFi & digital resources" : isCommunity ? "Community WiFi & local marketplace" : "Free internet, great content"}
          </Text>
          {isInstitution && (
            <View className="mt-2.5 flex-row items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(46,90,62,0.12)", borderWidth: 1, borderColor: "rgba(46,90,62,0.25)" }}>
              <GraduationCap size={11} color="#2E5A3E" />
              <Text className="text-[10px] font-sans-semibold" style={{ color: "#2E5A3E" }}>
                {siteInfo?.name ?? "Institution Network"}
              </Text>
            </View>
          )}
          {isCommunity && (
            <View className="mt-2.5 flex-row items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(46,90,62,0.12)", borderWidth: 1, borderColor: "rgba(46,90,62,0.25)" }}>
              <Users size={11} color="#2E5A3E" />
              <Text className="text-[10px] font-sans-semibold" style={{ color: "#2E5A3E" }}>
                {siteInfo?.name ?? "Community Network"}
              </Text>
            </View>
          )}
        </View>

        <View className="mb-5 rounded-3xl px-4 pt-4 pb-4" style={{ backgroundColor: "rgba(46,90,62,0.08)", borderWidth: 1, borderColor: "rgba(29,60,42,0.08)" }}>
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-sm font-sans-semibold" style={{ color: "#1D3C2A" }}>
              Your Activator
            </Text>
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: activatorLocked ? "#3C6A4A" : "#C45C38" }}>
              <Text className="text-[10px] font-sans-semibold text-white">{activatorLocked ? "Locked" : "Required"}</Text>
            </View>
          </View>
          <Text className="text-xs mb-3" style={{ color: "#2E5A3E" }}>
            {activatorLocked ? "Set on your first purchase — cannot be changed" : "Who introduced you to Ungana?"}
          </Text>
          <ActivatorDropdown
            value={activator}
            onChange={(a) => {
              setActivator(a);
              setActivatorError(false);
            }}
            error={activatorError}
            locked={activatorLocked}
          />
          {activator && (
            <View className="flex-row items-center gap-2 mt-2.5 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(46,90,62,0.1)", borderWidth: 1, borderColor: "rgba(46,90,62,0.15)" }}>
              <CheckCircle2 size={13} color="#3C6A4A" />
              <Text className="text-[11px]" style={{ color: "#3C6A4A" }}>
                {activator.id === "SELF" ? (
                  <Text className="font-sans-semibold" style={{ color: "#1D3C2A" }}>
                    Self-onboarded
                  </Text>
                ) : (
                  <>
                    Referred by <Text className="font-sans-semibold" style={{ color: "#1D3C2A" }}>{activator.name}</Text> · {activator.area}
                  </>
                )}
              </Text>
            </View>
          )}
        </View>

        <View className="h-px mb-5" style={{ backgroundColor: "#1D3C2A", opacity: 0.1 }} />

        {siteMode === null && (
          <View className="mb-5" style={{ gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} className="rounded-3xl" style={{ height: 76, backgroundColor: "rgba(46,90,62,0.08)" }} />
            ))}
          </View>
        )}

        {siteMode && siteMode !== "earn_only" && (
          <>
            <View className="mb-4">
              <Text className="text-lg font-serif" style={{ color: "#1D3C2A" }}>
                Choose your plan
              </Text>
              <Text className="text-xs mt-0.5" style={{ color: "#2E5A3E" }}>
                Select how long you want access
              </Text>
            </View>

            <View className="mb-5" style={{ gap: 12 }}>
              {packages.map((pkg) => {
                const Icon = pkg.icon;
                const isSelected = selected === pkg.id;
                return (
                  <Pressable
                    key={pkg.id}
                    onPress={() => setSelected(pkg.id)}
                    className="w-full rounded-3xl"
                    style={{
                      backgroundColor: isSelected ? "#2E5A3E" : "rgba(46,90,62,0.08)",
                      borderWidth: 2,
                      borderColor: isSelected ? "#C45C38" : "transparent",
                    }}
                  >
                    <View className="flex-row items-center gap-4 px-5 py-4">
                      <View className="w-11 h-11 rounded-2xl items-center justify-center" style={{ backgroundColor: isSelected ? "rgba(196,92,56,0.35)" : "rgba(46,90,62,0.12)" }}>
                        <Icon size={20} color={isSelected ? "#C45C38" : "#3C6A4A"} strokeWidth={2} />
                      </View>
                      <View className="flex-1 min-w-0">
                        <View className="flex-row items-center gap-2 mb-0.5">
                          <Text className="text-base font-sans-semibold" style={{ color: isSelected ? "#E8D4B0" : "#1D3C2A" }}>
                            {pkg.label}
                          </Text>
                          {pkg.badge && (
                            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: "#C45C38" }}>
                              <Text className="text-[10px] font-sans-semibold text-white">{pkg.badge}</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-xs" style={{ color: isSelected ? "#C4DAC0" : "#3C6A4A" }}>
                          {pkg.duration} of free internet
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-xl font-sans-semibold" style={{ color: isSelected ? "#C45C38" : "#1D3C2A" }}>
                          {pkg.price} <Text className="text-xs" style={{ color: isSelected ? "#C45C38" : "#3C6A4A" }}>KES</Text>
                        </Text>
                        <Text className="text-[10px] font-sans-medium mt-0.5" style={{ color: isSelected ? "#C4DAC0" : "#9AB498" }}>
                          {pkg.duration}
                        </Text>
                      </View>
                    </View>

                    {isSelected && (
                      <View className="mx-5 mb-4">
                        {(pkg.id === "weekly" || pkg.id === "monthly") && (
                          <View className="flex-row items-center gap-2 mb-3 px-1">
                            <Clock size={13} color="#E8D4B0" />
                            <Text className="text-[11px]" style={{ color: "#C4DAC0" }}>
                              That's only{" "}
                              <Text className="font-sans-semibold" style={{ color: "#E8D4B0" }}>
                                {(pkg.price / (pkg.id === "weekly" ? 7 : 30)).toFixed(0)} KES/day
                              </Text>{" "}
                              — saving you {pkg.id === "weekly" ? "30%" : "50%"}
                            </Text>
                          </View>
                        )}
                        <Pressable
                          onPress={() => {
                            if (!activator) {
                              setActivatorError(true);
                              return;
                            }
                            onSelect(pkg, activator);
                          }}
                          className="w-full py-3.5 rounded-2xl flex-row items-center justify-center gap-2"
                          style={{
                            backgroundColor: activator ? "#C45C38" : "transparent",
                            borderWidth: activator ? 0 : 2,
                            borderColor: "rgba(232,212,176,0.4)",
                            borderStyle: activator ? "solid" : "dashed",
                          }}
                        >
                          <Text className="text-sm font-sans-semibold" style={{ color: activator ? "#fff" : "rgba(232,212,176,0.6)", letterSpacing: 0.5 }}>
                            Buy Package
                          </Text>
                          <ChevronRight size={16} color={activator ? "#fff" : "rgba(232,212,176,0.6)"} />
                        </Pressable>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {siteMode && siteMode !== "pay_only" && (
          <>
            {siteMode !== "earn_only" && (
              <View className="flex-row items-center gap-3 mt-3 mb-3">
                <View className="flex-1 h-px" style={{ backgroundColor: "rgba(29,60,42,0.15)" }} />
                <Text className="text-[11px] font-sans-medium" style={{ color: "#9AB498" }}>
                  or
                </Text>
                <View className="flex-1 h-px" style={{ backgroundColor: "rgba(29,60,42,0.15)" }} />
              </View>
            )}
            <View className="w-full mb-2">
              <Pressable
                disabled={!identityKnown}
                onPress={() => {
                  if (!activator) {
                    setActivatorError(true);
                    return;
                  }
                  onEarnAccess();
                }}
                className="w-full rounded-3xl overflow-hidden"
                style={{
                  backgroundColor: identityKnown ? "#C45C38" : "transparent",
                  borderWidth: identityKnown ? 0 : 2,
                  borderColor: "rgba(29,60,42,0.25)",
                  borderStyle: identityKnown ? "solid" : "dashed",
                }}
              >
                <View className="flex-row items-center gap-4 px-5 py-4">
                  <View
                    className="w-11 h-11 rounded-2xl items-center justify-center"
                    style={{ backgroundColor: identityKnown ? "rgba(255,255,255,0.22)" : "rgba(46,90,62,0.12)" }}
                  >
                    <Zap size={20} color={identityKnown ? "#fff" : "#3C6A4A"} strokeWidth={2} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center gap-2 mb-0.5">
                      <Text className="text-base font-sans-semibold" style={{ color: identityKnown ? "#fff" : "#1D3C2A" }}>
                        Earn Free Access
                      </Text>
                      {identityKnown && (
                        <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.28)" }}>
                          <Text className="text-[10px] font-sans-semibold text-white">FREE</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs" style={{ color: identityKnown ? "rgba(255,255,255,0.85)" : "#3C6A4A" }}>
                      {identityKnown ? "Watch & learn to unlock internet time" : "Reconnect to Ungana Wi-Fi to earn, or log in as user"}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={identityKnown ? "#fff" : "#9AB498"} />
                </View>
              </Pressable>
            </View>
          </>
        )}

        <View className="items-center mt-3" style={{ gap: 10 }}>
          <View className="flex-row items-center rounded-full overflow-hidden" style={{ backgroundColor: "rgba(46,90,62,0.08)", borderWidth: 1, borderColor: "rgba(29,60,42,0.08)" }}>
            {/* Only a guest this device doesn't already recognize needs a
                way back to the by-username lookup — once there's a known
                session (e.g. mid-session via ActiveScreen's "Extend"), this
                segment would just be a dead end back to a screen asking for
                info the app already has. */}
            {!identityKnown && (
              <>
                <Pressable onPress={onCheckSession} hitSlop={6} className="flex-row items-center gap-1.5 px-3.5 py-2">
                  <UserCircle2 size={12} color="#CC8830" />
                  <Text className="text-[11px] font-sans-semibold" style={{ color: "#CC8830" }}>
                    User
                  </Text>
                </Pressable>
                <View style={{ width: 1, height: 14, backgroundColor: "rgba(29,60,42,0.12)" }} />
              </>
            )}
            <Pressable onPress={onActivatorLogin} hitSlop={6} className="flex-row items-center gap-1.5 px-3.5 py-2">
              <UserCheck size={12} color="#2E5A3E" />
              <Text className="text-[11px] font-sans-semibold" style={{ color: "#2E5A3E" }}>
                Activator
              </Text>
            </Pressable>
            <View style={{ width: 1, height: 14, backgroundColor: "rgba(29,60,42,0.12)" }} />
            <Pressable onPress={onCoordinatorLogin} hitSlop={6} className="flex-row items-center gap-1.5 px-3.5 py-2">
              <ShieldCheck size={12} color="#3C6A4A" />
              <Text className="text-[11px] font-sans-semibold" style={{ color: "#3C6A4A" }}>
                Coordinator
              </Text>
            </Pressable>
            <View style={{ width: 1, height: 14, backgroundColor: "rgba(29,60,42,0.12)" }} />
            <Pressable onPress={onAdminLogin} hitSlop={6} className="flex-row items-center gap-1.5 px-3.5 py-2">
              <ShieldCheck size={12} color="#3C6A4A" />
              <Text className="text-[11px] font-sans-semibold" style={{ color: "#3C6A4A" }}>
                Admin
              </Text>
            </Pressable>
          </View>
          <Text className="text-[10px]" style={{ color: "#9AB498" }}>
            swap.ungana.app
          </Text>
        </View>
      </View>
    </ScreenBg>
  );
}
