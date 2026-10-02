// Ported from frontend/src/lib/screens/CoordinatorLoginScreen.svelte —
// real-backend login only, no offline PIN-fallback/demo hint (see the plan
// doc). Presentational only; app/coordinator/login.tsx owns navigation.
import { useState } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ShieldCheck, Eye, EyeOff, AlertTriangle, ChevronRight, ArrowLeft } from "lucide-react-native";
import { coordinatorLogin, type CoordinatorProfile } from "@/lib/coordinatorApi";

export default function CoordinatorLoginScreen({ onLogin, onBack }: { onLogin: (token: string, coordinator: CoordinatorProfile) => void; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (phone.length < 9) {
      setError("Enter a valid phone number");
      return;
    }
    if (pin.length < 4) {
      setError("Enter your PIN");
      return;
    }
    setError("");
    setLoading(true);
    const result = await coordinatorLogin(`+254${phone}`, pin);
    setLoading(false);

    if (result.ok && result.data?.success) {
      onLogin(result.data.token, result.data.coordinator);
      return;
    }
    setError(result.data?.message || "Could not reach the server — try again in a moment.");
  }

  return (
    <LinearGradient colors={["#E8D4B0", "#DBC89A"]} style={{ flex: 1 }}>
      <Pressable
        onPress={onBack}
        className="absolute w-9 h-9 rounded-full items-center justify-center active:scale-90"
        style={{ top: insets.top + 12, left: 20, backgroundColor: "rgba(29,60,42,0.12)", zIndex: 2 }}
      >
        <ArrowLeft size={18} color="#1D3C2A" />
      </Pressable>

      <View className="flex-1 px-5" style={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }}>
        <View className="items-center pb-6">
          <View className="w-16 h-16 rounded-3xl items-center justify-center mb-4" style={{ backgroundColor: "#1D3C2A" }}>
            <ShieldCheck size={30} color="#C45C38" />
          </View>
          <Text className="text-[10px] font-semibold uppercase mb-1" style={{ color: "#96B496", letterSpacing: 1.5 }}>
            Coordinator Access
          </Text>
          <Text className="font-serif text-2xl font-bold text-center" style={{ color: "#1D3C2A" }}>
            Command Portal
          </Text>
          <Text className="text-xs mt-1 text-center" style={{ color: "#96B496" }}>
            For location coordinators only
          </Text>
        </View>

        <View className="rounded-3xl overflow-hidden" style={{ backgroundColor: "#2E5A3E" }}>
          <View className="px-5 pt-5 pb-1">
            <Text className="text-[10px] uppercase font-semibold mb-3" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
              Phone Number
            </Text>
            <View className="flex-row items-center gap-3 px-4 py-3 rounded-2xl mb-4" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
              <Text className="font-semibold text-sm" style={{ color: "#C4DAC0" }}>+254</Text>
              <TextInput
                value={phone}
                onChangeText={(t) => {
                  setPhone(t.replace(/[^0-9]/g, "").slice(0, 9));
                  setError("");
                }}
                placeholder="700 000 000"
                placeholderTextColor="#4A6842"
                keyboardType="number-pad"
                className="flex-1 text-sm font-semibold"
                style={{ color: "#E8D4B0" }}
              />
            </View>
            <Text className="text-[10px] uppercase font-semibold mb-3" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
              PIN
            </Text>
            <View className="flex-row items-center gap-3 px-4 py-3 rounded-2xl mb-1" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
              <ShieldCheck size={16} color="#C4DAC0" />
              <TextInput
                value={pin}
                onChangeText={(t) => {
                  setPin(t.replace(/[^0-9]/g, "").slice(0, 6));
                  setError("");
                }}
                placeholder="••••"
                placeholderTextColor="#4A6842"
                secureTextEntry={!showPin}
                keyboardType="number-pad"
                onSubmitEditing={handleLogin}
                className="flex-1 text-sm font-semibold"
                style={{ color: "#E8D4B0" }}
              />
              <Pressable onPress={() => setShowPin((s) => !s)}>
                {showPin ? <EyeOff size={16} color="#C4DAC0" /> : <Eye size={16} color="#C4DAC0" />}
              </Pressable>
            </View>
          </View>

          {!!error && (
            <View className="mx-5 mt-3 flex-row items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(184,80,56,0.32)" }}>
              <AlertTriangle size={13} color="#B85038" />
              <Text className="text-xs" style={{ color: "#B85038" }}>{error}</Text>
            </View>
          )}

          <View className="px-5 pt-3 pb-5">
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              className="w-full py-4 rounded-2xl items-center flex-row justify-center gap-2 active:scale-95"
              style={{ backgroundColor: "#C45C38", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="font-bold text-sm" style={{ color: "#fff" }}>Verifying…</Text>
                </>
              ) : (
                <>
                  <Text className="font-bold text-sm" style={{ color: "#fff" }}>Access Portal</Text>
                  <ChevronRight size={16} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        </View>

        <Text className="text-[10px] text-center mt-4" style={{ color: "#4A6842" }}>
          Not a coordinator? Use the back button above.
        </Text>
      </View>
    </LinearGradient>
  );
}
