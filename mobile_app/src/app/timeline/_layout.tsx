// Provides TimelineContext + WatchEarnContext to the whole tab group below
// — scoped here rather than the root layout since this data only matters
// while inside Campus/Community/Watch (see TimelineContext.tsx's header
// comment). WatchEarnOverlays is mounted here too, as a sibling to the
// tabs' own Stack, so the earned-balance modal/banners/username-prompt are
// visible across both tabs rather than owned by the Watch tab alone — see
// the plan doc's "Key architectural call".
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, router } from "expo-router";
import { Zap } from "lucide-react-native";
import { TimelineProvider } from "@/flow/TimelineContext";
import { WatchEarnProvider, formatMinutesLabel } from "@/flow/WatchEarnContext";
import WatchEarnOverlays from "@/components/WatchEarnOverlays";
import { useFlow } from "@/flow/FlowContext";
import { hasKnownIdentity } from "@/lib/device";

export default function TimelineLayout() {
  const flow = useFlow();
  // Same invariant index.tsx enforces at the app's own entry point — a
  // device with no known mac (freshly logged out, or never deep-linked in
  // via the captive portal) can browse the catalogue fine, but every
  // earn/claim call downstream requires a mac and the backend correctly
  // rejects a missing one (see content.js's "mac is required" guard). Before
  // this gate, that device could watch an entire item and only discover the
  // dead end at the claim step; redirecting up front sends it to
  // check-session instead, same as landing on the app with no identity at
  // all. Both entry points into this tab group (PackageScreen's "Earn Free
  // Access" and ActiveScreen's "Explore") route here without re-checking
  // identity themselves, so this is the one place that has to catch it.
  const identityKnown = hasKnownIdentity();
  useEffect(() => {
    if (!identityKnown) router.replace("/check-session");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!identityKnown) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#1D3C2A" }}>
        <ActivityIndicator color="#c29d53" />
      </View>
    );
  }

  // Mirrors +page.svelte's onConnect (lines 242-250): builds a synthetic
  // "Earned" package out of the claimed duration and hands off to the same
  // connecting/active flow a paid purchase uses.
  function onConnect(secs: number, isReal: boolean) {
    flow.setSelectedPkg({
      id: "daily",
      label: "Earned",
      duration: formatMinutesLabel(secs),
      price: 0,
      icon: Zap,
      badge: "Earned via content",
      demoSecs: secs,
    });
    flow.setPhone("earned");
    flow.setExpectRealSession(isReal);
    router.replace("/connecting");
  }

  return (
    <TimelineProvider>
      <WatchEarnProvider onConnect={onConnect}>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, animation: "none" }} />
          <WatchEarnOverlays />
        </View>
      </WatchEarnProvider>
    </TimelineProvider>
  );
}
