// Shared sticky header for the Campus/Community + Watch & Learn tabs —
// ported from TimelineScreen.svelte's header div, including the
// earned-balance pill (template lines ~1378-1398). Reads WatchEarnContext
// directly (same convention as CampusCommunityScreen calling useTimeline()
// internally) rather than prop-drilling, since both tabs sit under
// WatchEarnProvider (see app/timeline/_layout.tsx).
//
// Also the home for the "buy access instantly" entry point when nothing's
// earned yet — that used to live in a persistent bottom bar
// (WatchEarnOverlays' old BottomConnectBar), which on an institution/
// community site sat on top of (tabs)/_layout.tsx's own native tab bar,
// covering it. This pill sits in the same slot the earned-balance pill
// uses once there's something to show, so there's always exactly one
// consistent top-level action here instead of a second bottom bar.
//
// ActiveSessionBanner sits in the middle of the SAME row as the logo and
// the pills/back button — three flex-1 columns (left/center/right), not a
// second stacked row. Two earlier approaches both had a real problem:
//   - position:absolute over the row: doesn't contribute to the parent's
//     height, so the header stayed exactly as tall as the row alone and the
//     (taller) badge spilled past the bottom edge into the content below.
//   - a separate centered row above the main one: correctly avoided the
//     overflow, but added a visible gap above the logo/pills even when
//     there's no session to show, since an admittedly-empty row still has
//     to exist for the "there is a session" case.
// A flex-1 middle column has neither problem: contributes zero height when
// ActiveSessionBanner renders null (the row's height is driven by the
// logo/pills columns, same as before this ever existed), and when it does
// render, the row simply grows to fit it — still one row, never a separate
// one, and never positioned in a way that can escape the row's own bounds.
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Zap, ShoppingBag } from "lucide-react-native";
import UnganaLogoMark from "@/components/UnganaLogoMark";
import { useWatchEarn } from "@/flow/WatchEarnContext";
import ActiveSessionBanner from "@/components/ActiveSessionBanner";

export default function TimelineHeader({ onBack }: { onBack: () => void }) {
  const w = useWatchEarn();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ backgroundColor: "#1D3C2A", paddingTop: insets.top + 12 }}>
      <View className="px-4 pb-3 flex-row items-center">
        <View className="flex-1 flex-row items-center gap-2">
          <UnganaLogoMark height={26} />
          <Text className="text-base font-serif" style={{ color: "#E8D4B0" }}>
            Ungana
          </Text>
        </View>
        <View className="flex-1 items-center">
          <ActiveSessionBanner variant="dark" />
        </View>
        <View className="flex-1 flex-row items-center justify-end gap-2">
          {w.totalEarnedSecs > 0 ? (
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
          ) : (
            <Pressable
              onPress={() => router.replace("/packages")}
              className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-full active:scale-90"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <ShoppingBag size={11} color="#C4DAC0" />
              <Text className="text-[11px] font-bold" style={{ color: "#C4DAC0" }}>Buy access</Text>
            </Pressable>
          )}
          <Pressable onPress={onBack} className="w-8 h-8 rounded-full items-center justify-center active:scale-90" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
            <ArrowLeft size={16} color="#C4DAC0" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
