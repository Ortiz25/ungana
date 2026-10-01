// Ported from frontend/src/lib/screens/WarningScreen.svelte.
import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, WifiOff, Clock, RotateCcw, type LucideIcon } from "lucide-react-native";
import DemoBadge from "@/components/DemoBadge";
import { formatTime, type Package } from "@/lib/data";

const ROWS: { icon: LucideIcon; text: string }[] = [
  { icon: WifiOff, text: "Internet access will stop" },
  { icon: Clock, text: "Your session will be archived" },
  { icon: RotateCcw, text: "You can buy a new session anytime" },
];

export default function WarningScreen({
  pkg: _pkg,
  remaining,
  mode = "simulation",
  onExtend,
  onDismiss,
}: {
  pkg: Package;
  remaining: number;
  mode?: "simulation" | "active";
  onExtend: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [secs, setSecs] = useState(remaining);

  useEffect(() => {
    if (remaining <= 0) {
      onDismiss();
      return;
    }
    const t = setInterval(() => {
      setSecs((prev) => {
        if (prev - 1 <= 0) {
          clearInterval(t);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LinearGradient colors={["#2C1A12", "#3E2418"]} style={{ flex: 1 }}>
      <View className="flex-1 items-center px-5" style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <View className="items-center mt-10 mb-6">
          <View
            className="w-24 h-24 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: "rgba(196,92,56,0.30)", borderWidth: 2, borderColor: "rgba(196,92,56,0.4)" }}
          >
            <AlertTriangle size={44} color="#C45C38" strokeWidth={1.5} />
          </View>
          <View className="px-3 py-1 rounded-full mb-3" style={{ backgroundColor: "rgba(196,92,56,0.30)", borderWidth: 1, borderColor: "rgba(196,92,56,0.3)" }}>
            <Text className="text-xs font-sans-semibold uppercase tracking-widest" style={{ color: "#C45C38", letterSpacing: 1.5 }}>
              Time Running Out
            </Text>
          </View>
          <Text className="text-2xl font-serif text-center" style={{ color: "#E8D4B0" }}>
            Your session is{"\n"}about to end
          </Text>
          <Text className="text-sm mt-2 text-center" style={{ color: "#C4A870" }}>
            Don't lose your connection
          </Text>
        </View>

        <View className="w-full rounded-3xl overflow-hidden mb-5" style={{ backgroundColor: "rgba(196,92,56,0.1)", borderWidth: 2, borderColor: "rgba(196,92,56,0.3)" }}>
          <View className="items-center py-6">
            <Text className="text-5xl font-sans-semibold" style={{ color: "#C45C38", letterSpacing: -2 }}>
              {formatTime(secs)}
            </Text>
            <Text className="text-xs mt-2 uppercase tracking-widest" style={{ color: "#C4A870" }}>
              time remaining
            </Text>
            <View className="w-40 h-1.5 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
              <View className="h-full rounded-full" style={{ backgroundColor: "#C45C38", width: `${(secs / remaining) * 100}%` }} />
            </View>
          </View>
        </View>

        <View className="w-full rounded-2xl px-4 py-4 mb-5" style={{ backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
          <Text className="text-xs font-sans-semibold uppercase tracking-wider mb-3" style={{ color: "#C4A870" }}>
            When time runs out
          </Text>
          {ROWS.map((row, i) => {
            const Icon = row.icon;
            return (
              <View key={row.text} className="flex-row items-center gap-3" style={i < ROWS.length - 1 ? { marginBottom: 10 } : undefined}>
                <View className="w-7 h-7 rounded-lg items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.28)" }}>
                  <Icon size={14} color="#C45C38" />
                </View>
                <Text className="text-sm" style={{ color: "#C4A870" }}>
                  {row.text}
                </Text>
              </View>
            );
          })}
        </View>

        <Pressable onPress={onExtend} className="w-full py-4 rounded-2xl mb-3 active:opacity-90" style={{ backgroundColor: "#C45C38" }}>
          <Text className="text-base font-sans-semibold text-center text-white" style={{ letterSpacing: 0.5 }}>
            Extend Now — Stay Connected
          </Text>
        </Pressable>
        <Pressable onPress={onDismiss} className="w-full py-3.5 rounded-2xl active:opacity-80" style={{ backgroundColor: "rgba(255,255,255,0.14)" }}>
          <Text className="text-sm font-sans-semibold text-center" style={{ color: "#9A8060" }}>
            Let it expire
          </Text>
        </Pressable>
        {mode !== "active" && <DemoBadge />}
      </View>
    </LinearGradient>
  );
}
