// Ported from frontend/src/lib/components/DemoBadge.svelte.
import { View, Text } from "react-native";

export default function DemoBadge() {
  return (
    <View className="flex-row justify-center mt-3">
      <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(46,90,62,0.1)" }}>
        <Text className="text-[9px] font-sans-semibold uppercase tracking-widest" style={{ color: "#9AB498", letterSpacing: 1.5 }}>
          Demo · timers accelerated
        </Text>
      </View>
    </View>
  );
}
