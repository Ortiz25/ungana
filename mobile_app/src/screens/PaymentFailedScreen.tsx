// Ported from frontend/src/lib/screens/PaymentFailedScreen.svelte.
import { View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleX, RotateCcw, Home, MessageCircle } from "lucide-react-native";
import DemoBadge from "@/components/DemoBadge";
import type { Package } from "@/lib/data";

export default function PaymentFailedScreen({
  pkg,
  phone,
  mode = "simulation",
  reason,
  onRetry,
  onHome,
}: {
  pkg: Package;
  phone: string;
  mode?: "simulation" | "active";
  reason: { title: string; detail: string } | null;
  onRetry: () => void;
  onHome: () => void;
}) {
  const insets = useSafeAreaInsets();
  const rows = [
    { label: "Plan", value: `${pkg.label} · ${pkg.duration}` },
    { label: "Phone", value: `+254 ${phone}` },
    { label: "Amount", value: `${pkg.price.toLocaleString()} KES` },
    { label: "Status", value: "Not charged" },
  ];

  return (
    <LinearGradient colors={["#2C1A12", "#3E2418"]} style={{ flex: 1 }}>
      <View className="flex-1 items-center px-5" style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <View className="items-center mt-10 mb-6">
          <View
            className="w-24 h-24 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: "rgba(184,80,56,0.25)", borderWidth: 2, borderColor: "rgba(184,80,56,0.4)" }}
          >
            <CircleX size={44} color="#B85038" strokeWidth={1.5} />
          </View>
          <View className="px-3 py-1 rounded-full mb-3" style={{ backgroundColor: "rgba(184,80,56,0.30)", borderWidth: 1, borderColor: "rgba(184,80,56,0.3)" }}>
            <Text className="text-xs font-sans-semibold uppercase tracking-widest" style={{ color: "#C0614A", letterSpacing: 1.5 }}>
              Payment Failed
            </Text>
          </View>
          <Text className="text-2xl font-serif text-center" style={{ color: "#E8D4B0" }}>
            Payment unsuccessful
          </Text>
          <Text className="text-sm mt-2 text-center" style={{ color: "#C4A870", maxWidth: 280 }}>
            {reason?.detail ?? "The M-PESA prompt could not be completed."}
          </Text>
        </View>

        <View className="w-full rounded-3xl overflow-hidden mb-4" style={{ backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
          <View className="px-5 pt-5 pb-3">
            <Text className="text-xs uppercase tracking-widest mb-3 font-sans-semibold" style={{ color: "#C4A870" }}>
              Attempt Details
            </Text>
            {rows.map((row, i) => (
              <View
                key={row.label}
                className="flex-row justify-between items-center py-2.5"
                style={i < rows.length - 1 ? { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" } : undefined}
              >
                <Text className="text-xs" style={{ color: "#C4A870" }}>
                  {row.label}
                </Text>
                <Text className="text-sm font-sans-semibold text-right" style={{ color: "#E8D4B0", maxWidth: "55%" }}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="w-full rounded-2xl px-4 py-3 flex-row items-center gap-3 mb-5" style={{ backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: "#C45C38" }} />
          <Text className="text-xs flex-1" style={{ color: "#C4A870" }}>
            You have not been charged. You can try again or contact support.
          </Text>
        </View>

        <Pressable onPress={onRetry} className="w-full py-4 rounded-2xl flex-row items-center justify-center gap-2 mb-3" style={{ backgroundColor: "#C45C38" }}>
          <RotateCcw size={17} color="#fff" />
          <Text className="text-base font-sans-semibold text-white">Try Again</Text>
        </Pressable>
        <Pressable onPress={onHome} className="w-full py-3.5 rounded-2xl flex-row items-center justify-center gap-2 mb-3" style={{ backgroundColor: "rgba(255,255,255,0.14)" }}>
          <Home size={16} color="#E8D4B0" />
          <Text className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
            Back to Home
          </Text>
        </Pressable>
        <Pressable className="w-full py-3.5 rounded-2xl flex-row items-center justify-center gap-2" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
          <MessageCircle size={16} color="#C4A870" />
          <Text className="text-sm font-sans-semibold" style={{ color: "#C4A870" }}>
            Contact Ungana Support
          </Text>
        </Pressable>
        {mode !== "active" && <DemoBadge />}
      </View>
    </LinearGradient>
  );
}
