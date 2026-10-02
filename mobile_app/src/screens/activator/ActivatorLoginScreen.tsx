// Ported from frontend/src/lib/screens/ActivatorLoginScreen.svelte —
// real-backend login only, no offline PIN-fallback/demo hint (see the plan
// doc: mobile builds real-mode-only for both staff dashboards). Presentational
// only; the route file (app/activator/login.tsx) owns navigation and calls
// useActivatorAuth() to persist the session, same split as AdminLoginScreen.
import { useState } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Eye, EyeOff, AlertTriangle, ChevronRight } from "lucide-react-native";
import UnganaLogoMark from "@/components/UnganaLogoMark";
import { activatorLogin, type ActivatorProfile } from "@/lib/activatorApi";

export default function ActivatorLoginScreen({ onLogin, onBack }: { onLogin: (token: string, activator: ActivatorProfile) => void; onBack: () => void }) {
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
      setError("Enter your 4-digit PIN");
      return;
    }
    setError("");
    setLoading(true);
    const result = await activatorLogin(`+254${phone}`, pin);
    setLoading(false);

    if (result.ok && result.data?.success) {
      onLogin(result.data.token, result.data.activator);
      return;
    }
    setError(result.data?.message || "Could not reach the server — try again in a moment.");
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#1D3C2A" }}>
      <Pressable
        onPress={onBack}
        className="absolute w-9 h-9 rounded-full items-center justify-center active:scale-90"
        style={{ top: insets.top + 12, left: 20, backgroundColor: "rgba(255,255,255,0.18)", zIndex: 2 }}
      >
        <ArrowLeft size={18} color="#C4DAC0" />
      </Pressable>

      <View className="flex-1 px-5" style={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }}>
        <View className="items-center pb-8">
          <UnganaLogoMark height={44} />
          <View className="mt-4 px-3 py-1 rounded-full" style={{ backgroundColor: "rgba(196,92,56,0.30)", borderWidth: 1, borderColor: "rgba(196,92,56,0.3)" }}>
            <Text className="text-[11px] font-bold uppercase" style={{ color: "#C45C38", letterSpacing: 1 }}>
              Activator Portal
            </Text>
          </View>
          <Text className="font-serif text-2xl font-bold mt-3 text-center" style={{ color: "#E8D4B0" }}>
            Welcome back
          </Text>
          <Text className="text-sm mt-1 text-center" style={{ color: "#C4DAC0" }}>
            Sign in to view your earnings and users
          </Text>
        </View>

        <View className="rounded-3xl overflow-hidden mb-4" style={{ backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
          <View className="px-5 pt-5 pb-2" style={{ gap: 12 }}>
            <View>
              <Text className="text-xs font-sans-semibold mb-1.5 uppercase" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
                Phone Number
              </Text>
              <View className="flex-row items-center rounded-2xl overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                <View className="px-4 py-3.5 shrink-0" style={{ borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.1)" }}>
                  <Text className="font-semibold text-sm" style={{ color: "#C4DAC0" }}>+254</Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t.replace(/[^0-9]/g, "").slice(0, 9));
                    setError("");
                  }}
                  placeholder="700 000 000"
                  placeholderTextColor="#4A6842"
                  keyboardType="number-pad"
                  className="flex-1 px-4 py-3.5 text-sm"
                  style={{ color: "#E8D4B0" }}
                />
              </View>
            </View>

            <View>
              <Text className="text-xs font-sans-semibold mb-1.5 uppercase" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
                4-Digit PIN
              </Text>
              <View className="flex-row items-center rounded-2xl overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                <TextInput
                  value={pin}
                  onChangeText={(t) => {
                    setPin(t.replace(/[^0-9]/g, "").slice(0, 4));
                    setError("");
                  }}
                  placeholder="••••"
                  placeholderTextColor="#4A6842"
                  secureTextEntry={!showPin}
                  keyboardType="number-pad"
                  onSubmitEditing={handleLogin}
                  className="flex-1 px-4 py-3.5 text-sm"
                  style={{ color: "#E8D4B0", letterSpacing: 4 }}
                />
                <Pressable onPress={() => setShowPin((s) => !s)} className="px-4 py-3.5 shrink-0">
                  {showPin ? <EyeOff size={16} color="#AECAAE" /> : <Eye size={16} color="#AECAAE" />}
                </Pressable>
              </View>
            </View>

            {!!error && (
              <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(192,97,74,0.12)", borderWidth: 1, borderColor: "rgba(192,97,74,0.25)" }}>
                <AlertTriangle size={13} color="#B85038" />
                <Text className="text-xs flex-1" style={{ color: "#B85038" }}>
                  {error}
                </Text>
              </View>
            )}
          </View>

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
                  <Text className="font-bold text-sm" style={{ color: "#fff" }}>Signing in…</Text>
                </>
              ) : (
                <>
                  <Text className="font-bold text-sm" style={{ color: "#fff" }}>Sign In</Text>
                  <ChevronRight size={16} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        </View>

        <Text className="text-[10px] text-center mt-2" style={{ color: "#4A6842" }}>
          Activator access only · Not a user?{" "}
          <Text onPress={onBack} className="font-semibold" style={{ color: "#AECAAE" }}>Go back</Text>
        </Text>
      </View>
    </View>
  );
}
