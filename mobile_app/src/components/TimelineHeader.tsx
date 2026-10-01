// Shared sticky header for the Campus/Community + Watch & Learn tabs —
// ported from TimelineScreen.svelte's header div, including the
// earned-balance pill (template lines ~1378-1398). Reads WatchEarnContext
// directly (same convention as CampusCommunityScreen calling useTimeline()
// internally) rather than prop-drilling, since both tabs sit under
// WatchEarnProvider (see app/timeline/_layout.tsx).
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Zap } from "lucide-react-native";
import UnganaLogoMark from "@/components/UnganaLogoMark";
import { useWatchEarn } from "@/flow/WatchEarnContext";

export default function TimelineHeader({ onBack }: { onBack: () => void }) {
  const w = useWatchEarn();
  const insets = useSafeAreaInsets();

  return (
    <View className="px-4 pb-3 flex-row items-center justify-between" style={{ backgroundColor: "#1D3C2A", paddingTop: insets.top + 12 }}>
      <View className="flex-row items-center gap-2">
        <UnganaLogoMark height={26} />
        <Text className="text-base font-serif" style={{ color: "#E8D4B0" }}>
          Ungana
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {w.totalEarnedSecs > 0 && (
          <Pressable
            onPress={() => {
              w.setClaimAmountMinutes(Math.floor(w.realUnclaimedSecs / 60));
              w.setShowEarnedModal(true);
            }}
            className="relative flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-full active:scale-90"
            style={{ backgroundColor: "rgba(196,92,56,0.22)", borderWidth: 1, borderColor: "rgba(196,92,56,0.5)" }}
          >
            <Zap size={11} color="#C45C38" />
            <Text className="text-[11px] font-bold" style={{ color: "#C45C38" }}>{w.earnedFormatted} earned</Text>
            {w.canConnect && (
              <View
                className="absolute rounded-full"
                style={{ top: -2, right: -2, width: 10, height: 10, backgroundColor: "#7EC88E", borderWidth: 2, borderColor: "#1D3C2A" }}
              />
            )}
          </Pressable>
        )}
        <Pressable onPress={onBack} className="w-8 h-8 rounded-full items-center justify-center active:scale-90" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
          <ArrowLeft size={16} color="#C4DAC0" />
        </Pressable>
      </View>
    </View>
  );
}
