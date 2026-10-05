// Ported from frontend/src/lib/screens/ActiveScreen.svelte. Two deliberate
// behavior drops, not oversights — see the plan doc's "MAC limitation"
// section:
//   - The "Go Online" button (window.open to release the captive portal)
//     has no native equivalent and is removed rather than reimplemented —
//     there's no captive-portal tab to release; the device's connection
//     already carries traffic once the router has authorized its real MAC.
//   - document.title tab-rewriting while hidden has no RN equivalent
//     (no background-tab concept) and is dropped; the "welcome back" banner
//     itself is kept, using RN's AppState to detect foreground return
//     instead of the Page Visibility API.
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Animated, AppState, Alert, Easing, type AppStateStatus } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { Wifi, Phone, RotateCcw, MessageCircle, Megaphone, Zap, Users, ChevronRight, LogOut } from "lucide-react-native";
import UnganaLogoMark from "@/components/UnganaLogoMark";
import DemoBadge from "@/components/DemoBadge";
import { formatTime, getWarningThreshold, type Package } from "@/lib/data";
import { getSite } from "@/lib/api";
import { getSiteId } from "@/lib/device";

const RADIUS = 60;
const CIRC = 2 * Math.PI * RADIUS;

export default function ActiveScreen({
  pkg,
  phone,
  mode = "simulation",
  initialRemaining = null,
  onExpiring,
  onExtend,
  onExplore,
  onSupport,
  onLogout,
}: {
  pkg: Package;
  phone: string;
  mode?: "simulation" | "active";
  initialRemaining?: number | null;
  // autoGoOnline is intentionally not a prop here — see the file header.
  onExpiring: () => void;
  onExtend: () => void;
  onExplore: () => void;
  // Opens the in-app AI assistant chat — only rendered at all when the
  // site's siteInfo.assistantEnabled is true (see the site-info effect
  // below), so this is never called for a site that hasn't opted in.
  onSupport: () => void;
  // Forgets this device (clears the recovered mac/site/username — see
  // lib/device.ts's clearIdentity) and returns to the entry flow. Confirmed
  // first since it's hard to undo: the device stops being auto-recognized
  // until someone checks the session by username again.
  onLogout: () => void;
}) {
  const insets = useSafeAreaInsets();
  const site = getSiteId();
  const [siteVertical, setSiteVertical] = useState("general");
  const isInstitution = siteVertical === "institution";
  const isCommunity = siteVertical === "community";
  const [assistantEnabled, setAssistantEnabled] = useState(false);

  const total = pkg.demoSecs;
  const warningThreshold = getWarningThreshold(total);
  const [remaining, setRemaining] = useState(initialRemaining ?? total);
  const warned = useRef(false);
  const [returnBanner, setReturnBanner] = useState(false);
  const bannerTranslate = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.spring(bannerTranslate, { toValue: returnBanner ? 0 : -60, useNativeDriver: true, friction: 8 }).start();
  }, [returnBanner, bannerTranslate]);

  // Gentle pulse on the LIVE dot — a cheap, cheerful "this is live" signal
  // that was missing entirely before (the badge just sat there static).
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  function confirmLogout() {
    Alert.alert(
      "Log out of this device?",
      "This phone will stop being recognized automatically — you'll need to check your session by username again next time.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log out", style: "destructive", onPress: onLogout },
      ]
    );
  }

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= warningThreshold && !warned.current) {
          warned.current = true;
          setTimeout(onExpiring, 0);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Foreground-return banner — the mobile equivalent of the source's Page
  // Visibility "welcome back" flash (the tab-title-rewriting half of that
  // effect has no native equivalent and isn't ported).
  useEffect(() => {
    function onChange(state: AppStateStatus) {
      if (state === "active") {
        setReturnBanner(true);
        setTimeout(() => setReturnBanner(false), 4000);
      }
    }
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    (async () => {
      if (site) {
        const result = await getSite(site);
        if (result.ok && result.data?.site) {
          setSiteVertical(result.data.site.vertical ?? "general");
          setAssistantEnabled(!!result.data.site.assistantEnabled);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = remaining / total;
  const minsLeft = Math.ceil(remaining / 60);
  const ringColor = pct > 0.4 ? "#C45C38" : pct > 0.2 ? "#CC8830" : "#B85038";

  return (
    <LinearGradient colors={["#1D3C2A", "#2E5A3E"]} style={{ flex: 1 }}>
    <View className="flex-1 px-5" style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }}>
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", top: 16, left: "50%", marginLeft: -110, zIndex: 50, transform: [{ translateY: bannerTranslate }] }}
      >
        <View
          className="flex-row items-center gap-2 px-4 py-2 rounded-full"
          style={{ backgroundColor: remaining <= warningThreshold ? "#B85038" : "#2E5A3E", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", width: 220 }}
        >
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: remaining <= warningThreshold ? "#ffb0a0" : "#C45C38" }} />
          <Text className="text-xs font-sans-semibold" numberOfLines={1} style={{ color: "#E8D4B0" }}>
            {remaining <= warningThreshold ? "⚠️ Session expiring soon!" : `${minsLeft} min left in your session`}
          </Text>
        </View>
      </Animated.View>

      <View className="flex-row items-center justify-between pt-5 pb-4">
        <View className="flex-row items-center gap-2">
          <UnganaLogoMark height={24} />
          <Text className="text-sm font-serif" style={{ color: "#E8D4B0" }}>
            Ungana
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(196,92,56,0.30)", borderWidth: 1, borderColor: "rgba(196,92,56,0.3)" }}>
          <View className="items-center justify-center" style={{ width: 8, height: 8 }}>
            <Animated.View
              pointerEvents="none"
              className="absolute rounded-full"
              style={{ width: 8, height: 8, backgroundColor: "#C45C38", opacity: 0.5, transform: [{ scale: pulse }] }}
            />
            <View className="rounded-full" style={{ width: 6, height: 6, backgroundColor: "#C45C38" }} />
          </View>
          <Text className="text-xs font-sans-semibold" style={{ color: "#C45C38" }}>
            LIVE
          </Text>
        </View>
      </View>

      <View className="rounded-3xl mb-5 overflow-hidden" style={{ backgroundColor: "rgba(196,92,56,0.08)", borderWidth: 1, borderColor: "rgba(196,92,56,0.35)" }}>
        <View className="px-5 py-4 flex-row items-center gap-4">
          <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.30)" }}>
            <Wifi size={24} color="#C45C38" />
          </View>
          <View>
            <Text className="text-base font-serif" style={{ color: "#E8D4B0" }}>
              You're Online!
            </Text>
            <Text className="text-xs mt-0.5" style={{ color: "#C4DAC0" }}>
              Session started · {pkg.label} plan
            </Text>
          </View>
        </View>
      </View>

      {/* No card behind the ring — it floats directly on the page's own
          gradient, with just a soft layered glow (decreasing-opacity
          circles, no expo-blur dependency) instead of a boxed panel. */}
      <View className="items-center mb-5">
        <View className="items-center justify-center" style={{ width: 176, height: 176 }}>
          <View className="absolute rounded-full" style={{ width: 176, height: 176, backgroundColor: ringColor, opacity: 0.08 }} />
          <View className="absolute rounded-full" style={{ width: 148, height: 148, backgroundColor: ringColor, opacity: 0.1 }} />
          <Svg width={176} height={176} style={{ transform: [{ rotate: "-90deg" }] }}>
            <Defs>
              <SvgLinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={ringColor} stopOpacity={0.6} />
                <Stop offset="1" stopColor={ringColor} stopOpacity={1} />
              </SvgLinearGradient>
            </Defs>
            <Circle cx={88} cy={88} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={11} />
            <Circle
              cx={88}
              cy={88}
              r={RADIUS}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth={11}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - Math.max(0, pct))}
            />
          </Svg>
          <View className="absolute items-center">
            <Text className="text-4xl font-sans-semibold" style={{ color: "#E8D4B0", letterSpacing: -1 }}>
              {formatTime(Math.max(0, remaining))}
            </Text>
            <Text className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: "#C4DAC0" }}>
              remaining
            </Text>
          </View>
        </View>
        <Text className="text-xs mt-3" style={{ color: "#AECAAE" }}>
          {pkg.duration} total · expires when timer ends
        </Text>
      </View>

      <View className="rounded-2xl px-4 py-3 flex-row items-center gap-3 mb-5" style={{ backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
        <View className="w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.30)" }}>
          <Phone size={14} color="#C45C38" />
        </View>
        <View className="flex-1">
          <Text className="text-[10px] uppercase tracking-wider" style={{ color: "#AECAAE" }}>
            Registered number
          </Text>
          <Text className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
            +254 {phone}
          </Text>
        </View>
      </View>

      <Pressable onPress={onExplore} className="w-full rounded-2xl p-4 flex-row items-center gap-3 mb-5 active:opacity-90" style={{ backgroundColor: "rgba(196,92,56,0.10)", borderWidth: 1, borderColor: "rgba(196,92,56,0.35)" }}>
        <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.30)" }}>
          {isInstitution ? <Megaphone size={18} color="#C45C38" /> : isCommunity ? <Users size={18} color="#C45C38" /> : <Zap size={18} color="#C45C38" />}
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
            {isInstitution ? "Explore Campus" : isCommunity ? "Explore Community" : "Watch & Earn"}
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: "#C4DAC0" }}>
            {isInstitution ? "Notices, exam timetable & more" : isCommunity ? "Announcements, marketplace & more" : "Earn extra time while you're connected"}
          </Text>
        </View>
        <ChevronRight size={16} color="#C4DAC0" />
      </Pressable>

      {/* Primary/secondary now actually read as different weights — Extend
          is the one action worth highlighting, Support is a quiet outline,
          not an identical twin of the same translucent fill. */}
      <Pressable onPress={onExtend} className="w-full py-4 rounded-2xl flex-row items-center justify-center gap-2 mb-2.5 active:opacity-90" style={{ backgroundColor: "#C45C38" }}>
        <RotateCcw size={15} color="#fff" />
        <Text className="text-sm font-sans-semibold text-white">Extend Session</Text>
      </Pressable>
      {assistantEnabled && (
        <Pressable onPress={onSupport} className="w-full py-3.5 rounded-2xl flex-row items-center justify-center gap-2 mb-5 active:opacity-70" style={{ backgroundColor: "transparent", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)" }}>
          <MessageCircle size={15} color="#C4DAC0" />
          <Text className="text-sm font-sans-semibold" style={{ color: "#C4DAC0" }}>
            Support
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={confirmLogout}
        className="self-center flex-row items-center gap-2 pl-2 pr-4 py-2 rounded-full active:opacity-70"
        style={{ backgroundColor: "rgba(184,80,56,0.10)", borderWidth: 1, borderColor: "rgba(184,80,56,0.25)" }}
      >
        <View className="items-center justify-center rounded-full" style={{ width: 20, height: 20, backgroundColor: "rgba(184,80,56,0.22)" }}>
          <LogOut size={11} color="#E89080" />
        </View>
        <Text className="text-xs font-sans-semibold" style={{ color: "#E89080" }}>
          Log out of this device
        </Text>
      </Pressable>

      {mode !== "active" && <DemoBadge />}
    </View>
    </LinearGradient>
  );
}
