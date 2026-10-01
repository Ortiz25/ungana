// Ported from frontend/src/lib/screens/CheckSessionScreen.svelte, including
// its Activator/Coordinator/Admin pill-bar footer — the same one used on
// PackageScreen.tsx, for visual consistency between the two entry screens.
import { useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Animated, Easing } from "react-native";
import { UserCheck, ShieldCheck, ChevronRight, AlertTriangle, ArrowRight, Package as PackageIcon } from "lucide-react-native";
import ScreenBg from "@/components/ScreenBg";
import UnganaLogoMark from "@/components/UnganaLogoMark";
import { getSessionByUsername } from "@/lib/api";
import { setRecoveredIdentity } from "@/lib/device";

export default function CheckSessionScreen({
  onFound,
  onSkip,
  onActivatorLogin,
  onCoordinatorLogin,
  onAdminLogin,
}: {
  onFound: (data: any) => void;
  onSkip: () => void;
  onActivatorLogin: () => void;
  onCoordinatorLogin: () => void;
  onAdminLogin: () => void;
}) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const arrowX = useRef(new Animated.Value(0)).current;
  useState(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowX, { toValue: 4, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(arrowX, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  });

  async function handleCheck() {
    if (!username.trim() || loading) return;
    setLoading(true);
    setError("");

    const result = await getSessionByUsername(username.trim());
    setLoading(false);

    if (!result.ok) {
      setError("Could not reach the server — try again in a moment.");
      return;
    }
    if (!result.data?.found) {
      setError("No session found for that username. Check the spelling, or it's your first time.");
      return;
    }
    // Persist this device as "the one that username belongs to" — the mac
    // (once the backend's sessionStatusPayload fix ships, see the plan doc)
    // and username both carry forward so a later "buy more time"/claim from
    // this app acts as the real recovered device, not a fresh unknown one.
    await setRecoveredIdentity({ mac: result.data.clientMac ?? null, site: result.data.siteId ?? null, username: username.trim() });
    onFound(result.data);
  }

  return (
    <ScreenBg className="items-center">
      <View className="items-center pt-6 pb-6">
        <UnganaLogoMark height={44} />
        <Text className="text-xl font-serif mt-3 text-center" style={{ color: "#1D3C2A" }}>
          Check your session
        </Text>
        <Text className="text-xs mt-1 text-center" style={{ color: "#2E5A3E", maxWidth: 260 }}>
          We couldn't tell which device this is — enter the username you set at checkout to pick up where you left off
        </Text>
      </View>

      <View className="w-full rounded-3xl overflow-hidden mb-4" style={{ backgroundColor: "#2E5A3E" }}>
        <View className="px-5 pt-5 pb-2">
          <Text className="text-xs font-sans-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#C4DAC0" }}>
            Username
          </Text>
          <View className="flex-row items-center gap-3 px-4 py-3 rounded-2xl" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
            <UserCheck size={16} color="#C4DAC0" />
            <TextInput
              value={username}
              onChangeText={(t) => {
                setUsername(t.replace(/\s/g, "").slice(0, 24));
                setError("");
              }}
              placeholder="e.g. swiftrunner42"
              placeholderTextColor="#4A6842"
              autoCapitalize="none"
              className="flex-1 text-sm font-sans-semibold"
              style={{ color: "#E8D4B0" }}
            />
          </View>
        </View>

        {!!error && (
          <View className="mx-5 mt-3 flex-row items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(184,80,56,0.22)" }}>
            <AlertTriangle size={13} color="#F0A08A" />
            <Text className="text-xs flex-1" style={{ color: "#F0A08A" }}>
              {error}
            </Text>
          </View>
        )}

        <View className="px-5 pt-4 pb-5">
          <Pressable
            onPress={handleCheck}
            disabled={!username.trim() || loading}
            className="w-full py-4 rounded-2xl flex-row items-center justify-center gap-2 active:opacity-90"
            style={{ backgroundColor: "#C45C38", opacity: !username.trim() ? 0.6 : 1 }}
          >
            {loading ? (
              <Text className="text-sm font-sans-semibold text-white">Checking…</Text>
            ) : (
              <>
                <Text className="text-sm font-sans-semibold text-white">Check Session</Text>
                <ChevronRight size={16} color="#fff" />
              </>
            )}
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={onSkip}
        className="w-full rounded-3xl flex-row items-center gap-3.5 px-4 py-3.5 active:opacity-90"
        style={{ backgroundColor: "rgba(46,90,62,0.08)", borderWidth: 1.5, borderColor: "rgba(46,90,62,0.18)" }}
      >
        <View className="w-10 h-10 rounded-2xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.14)" }}>
          <PackageIcon size={18} color="#C45C38" strokeWidth={2} />
        </View>
        <View className="flex-1">
          <Text className="text-[11px] font-sans-medium" style={{ color: "#2E5A3E" }}>
            New here?
          </Text>
          <Text className="text-sm font-sans-semibold" style={{ color: "#1D3C2A" }}>
            Buy a package
          </Text>
        </View>
        <Animated.View style={{ transform: [{ translateX: arrowX }] }}>
          <ArrowRight size={16} color="#C45C38" />
        </Animated.View>
      </Pressable>

      <Text className="text-[10px] text-center mt-4" style={{ color: "#9AB498" }}>
        Didn't set a username? Reconnect to the Wi-Fi network to be recognised automatically.
      </Text>

      <View className="items-center mt-4" style={{ gap: 10 }}>
        <View className="flex-row items-center rounded-full overflow-hidden" style={{ backgroundColor: "rgba(46,90,62,0.08)", borderWidth: 1, borderColor: "rgba(29,60,42,0.08)" }}>
          <Pressable onPress={onActivatorLogin} hitSlop={6} className="flex-row items-center gap-1.5 px-3.5 py-2">
            <UserCheck size={12} color="#2E5A3E" />
            <Text className="text-[11px] font-sans-semibold" style={{ color: "#2E5A3E" }}>
              Activator
            </Text>
          </Pressable>
          <View style={{ width: 1, height: 14, backgroundColor: "rgba(29,60,42,0.12)" }} />
          <Pressable onPress={onCoordinatorLogin} hitSlop={6} className="flex-row items-center gap-1.5 px-3.5 py-2">
            <ShieldCheck size={12} color="#3C6A4A" />
            <Text className="text-[11px] font-sans-semibold" style={{ color: "#3C6A4A" }}>
              Coordinator
            </Text>
          </Pressable>
          <View style={{ width: 1, height: 14, backgroundColor: "rgba(29,60,42,0.12)" }} />
          <Pressable onPress={onAdminLogin} hitSlop={6} className="flex-row items-center gap-1.5 px-3.5 py-2">
            <ShieldCheck size={12} color="#3C6A4A" />
            <Text className="text-[11px] font-sans-semibold" style={{ color: "#3C6A4A" }}>
              Admin
            </Text>
          </Pressable>
        </View>
        <Text className="text-[10px]" style={{ color: "#9AB498" }}>
          swap.ungana.app
        </Text>
      </View>
    </ScreenBg>
  );
}
