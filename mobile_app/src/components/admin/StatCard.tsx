// Ported from AdminDashboardScreen.svelte's {#snippet statCard(...)}.
import { View, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";

export default function StatCard({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string; color: string }) {
  return (
    <View className="rounded-2xl px-4 py-3.5 flex-row items-center gap-3" style={{ backgroundColor: "#2E5A3E", borderWidth: 1, borderColor: `${color}22`, flexBasis: "48%", flexGrow: 1 }}>
      <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: `${color}22` }}>
        <Icon size={17} color={color} />
      </View>
      <View className="flex-1 min-w-0">
        <Text numberOfLines={1} className="text-base font-bold" style={{ color: "#E8D4B0" }}>
          {value}
        </Text>
        <Text numberOfLines={1} className="text-[10px] uppercase" style={{ color: "#96B496", letterSpacing: 1 }}>
          {label}
        </Text>
      </View>
    </View>
  );
}
