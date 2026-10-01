// Ported from frontend/src/lib/screens/AdminLoginScreen.svelte. Presentational
// only (plain props) — the route file (app/admin/login.tsx) owns navigation
// and calls useAdminAuth() to actually persist the session on success, same
// "route owns nav+context, screen stays dumb" split as the rest of this app.
import { useState } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Eye, EyeOff, AlertTriangle, ChevronRight, ShieldCheck, User, Lock } from "lucide-react-native";
import UnganaLogoMark from "@/components/UnganaLogoMark";
import { adminLogin, type AdminInfo } from "@/lib/adminApi";

export default function AdminLoginScreen({ onLogin, onBack }: { onLogin: (token: string, admin: AdminInfo) => void; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username.trim() || !password) {
      setError("Enter your admin username and password");
      return;
    }
    setError("");
    setLoading(true);
    const result = await adminLogin(username.trim(), password);
    setLoading(false);

    if (result.ok && result.data?.success) {
      onLogin(result.data.token, result.data.admin);
      return;
    }
    setError(result.data?.message || "Could not sign in — check your connection");
  }

  return (
    <LinearGradient colors={["#1D3C2A", "#2E5A3E", "#1D3C2A"]} locations={[0, 0.6, 1]} style={{ flex: 1 }}>
      {/* Soft decorative glow behind the badge — same plain radial-gradient
          convention as PackageScreen's own header glow. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(196,92,56,0.22)", "transparent"]}
        style={{ position: "absolute", top: insets.top + 48, left: "50%", marginLeft: -130, width: 260, height: 260, borderRadius: 130 }}
      />

      <Pressable
        onPress={onBack}
        className="absolute w-9 h-9 rounded-full items-center justify-center active:scale-90"
        style={{ top: insets.top + 12, left: 20, backgroundColor: "rgba(255,255,255,0.18)", zIndex: 2 }}
      >
        <ArrowLeft size={18} color="#C4DAC0" />
      </Pressable>

      <View className="flex-1 px-5" style={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }}>
        <View className="items-center pb-8">
          <UnganaLogoMark height={40} />
          <View className="mt-4 w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: "#C45C38" }}>
            <ShieldCheck size={28} color="#fff" />
          </View>
          <Text className="font-serif text-2xl font-bold mt-4 text-center" style={{ color: "#E8D4B0" }}>
            Admin sign in
          </Text>
          <Text className="text-sm mt-1 text-center" style={{ color: "#C4DAC0" }}>
            Manage content, activators & coordinators
          </Text>
        </View>

        <View className="rounded-3xl overflow-hidden mb-4" style={{ backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }}>
          <View className="px-5 pt-5 pb-2" style={{ gap: 12 }}>
            <View>
              <Text className="text-xs font-sans-semibold mb-1.5 uppercase" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
                Username
              </Text>
              <View className="flex-row items-center rounded-2xl overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                <View className="px-4 py-3.5" style={{ borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.15)" }}>
                  <User size={14} color="#C4DAC0" />
                </View>
                <TextInput
                  value={username}
                  onChangeText={(t) => {
                    setUsername(t);
                    setError("");
                  }}
                  placeholder="admin"
                  placeholderTextColor="#4A6842"
                  autoCapitalize="none"
                  className="flex-1 px-4 py-3.5 text-sm"
                  style={{ color: "#E8D4B0" }}
                />
              </View>
            </View>

            <View>
              <Text className="text-xs font-sans-semibold mb-1.5 uppercase" style={{ color: "#C4DAC0", letterSpacing: 1 }}>
                Password
              </Text>
              <View className="flex-row items-center rounded-2xl overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                <View className="px-4 py-3.5" style={{ borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.15)" }}>
                  <Lock size={14} color="#C4DAC0" />
                </View>
                <TextInput
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    setError("");
                  }}
                  placeholder="••••••••"
                  placeholderTextColor="#4A6842"
                  secureTextEntry={!showPassword}
                  onSubmitEditing={handleLogin}
                  className="flex-1 px-4 py-3.5 text-sm"
                  style={{ color: "#E8D4B0" }}
                />
                <Pressable onPress={() => setShowPassword((s) => !s)} className="px-4 py-3.5">
                  {showPassword ? <EyeOff size={16} color="#AECAAE" /> : <Eye size={16} color="#AECAAE" />}
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
                  <Text className="font-bold text-sm" style={{ color: "#fff" }}>
                    Signing in…
                  </Text>
                </>
              ) : (
                <>
                  <Text className="font-bold text-sm" style={{ color: "#fff" }}>
                    Sign In
                  </Text>
                  <ChevronRight size={16} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        </View>

        <Text className="text-[10px] text-center mt-2" style={{ color: "#4A6842" }}>
          Admin accounts are provisioned via the backend CLI, not self-signup.
        </Text>
      </View>
    </LinearGradient>
  );
}
