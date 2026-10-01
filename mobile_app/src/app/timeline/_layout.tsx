// Provides TimelineContext + WatchEarnContext to the whole tab group below
// — scoped here rather than the root layout since this data only matters
// while inside Campus/Community/Watch (see TimelineContext.tsx's header
// comment). WatchEarnOverlays is mounted here too, as a sibling to the
// tabs' own Stack, so the earned-balance pill/bottom bar/modals are visible
// across both tabs rather than owned by the Watch tab alone — see the plan
// doc's "Key architectural call".
import { View } from "react-native";
import { Stack, router } from "expo-router";
import { Zap } from "lucide-react-native";
import { TimelineProvider } from "@/flow/TimelineContext";
import { WatchEarnProvider, formatMinutesLabel } from "@/flow/WatchEarnContext";
import WatchEarnOverlays from "@/components/WatchEarnOverlays";
import { useFlow } from "@/flow/FlowContext";

export default function TimelineLayout() {
  const flow = useFlow();

  function onBuyAccess() {
    router.replace("/packages");
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
          <WatchEarnOverlays onBuyAccess={onBuyAccess} />
        </View>
      </WatchEarnProvider>
    </TimelineProvider>
  );
}
