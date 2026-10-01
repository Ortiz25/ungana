// Ported from frontend/src/lib/screens/ConnectingScreen.svelte. Pure
// cosmetic screen — three pulsing rings + a 400ms dot-cycle, then
// onConnected() fires after a flat 3s, same as the source (no backend call
// happens here itself).
import { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Wifi, CheckCircle2 } from "lucide-react-native";
import UnganaLogoMark from "@/components/UnganaLogoMark";

const STEPS = ["Payment verified", "Allocating session", "Connecting to network"];
const RINGS = [1, 0.6, 0.35];

function PulseRing({ baseSize, opacity, duration }: { baseSize: number; opacity: number; duration: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: duration * 1000, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [progress, duration]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.3] });
  const ringOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [opacity, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: baseSize,
        height: baseSize,
        borderRadius: baseSize / 2,
        borderWidth: 2,
        borderColor: "#C45C38",
        opacity: ringOpacity,
        transform: [{ scale }],
      }}
    />
  );
}

export default function ConnectingScreen({ onConnected }: { onConnected: () => void | Promise<void> }) {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const d = setInterval(() => setDots((prev) => (prev + 1) % 4), 400);
    const t = setTimeout(() => {
      onConnected();
    }, 3000);
    return () => {
      clearInterval(d);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LinearGradient colors={["#1D3C2A", "#2E5A3E"]} style={{ flex: 1 }}>
      <View className="flex-1 items-center justify-center px-8">
        <View className="items-center" style={{ gap: 24 }}>
          <View className="items-center justify-center" style={{ width: 140, height: 140 }}>
            {RINGS.map((o, i) => (
              <PulseRing key={i} baseSize={60 + i * 36} opacity={o} duration={1.2 + i * 0.3} />
            ))}
            <View
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{ backgroundColor: "rgba(196,92,56,0.30)", borderWidth: 2, borderColor: "#C45C38" }}
            >
              <Wifi size={28} color="#C45C38" />
            </View>
          </View>

          <UnganaLogoMark height={36} />

          <View className="items-center">
            <Text className="text-xl font-serif" style={{ color: "#E8D4B0" }}>
              Connecting you{".".repeat(dots)}
            </Text>
            <Text className="text-sm mt-2" style={{ color: "#C4DAC0" }}>
              Setting up your internet session
            </Text>
          </View>

          <View className="w-full" style={{ gap: 8 }}>
            {STEPS.map((step, i) => (
              <View key={step} className="flex-row items-center gap-3">
                <View
                  className="w-5 h-5 rounded-full items-center justify-center"
                  style={{ backgroundColor: i < 2 ? "rgba(196,92,56,0.25)" : "rgba(255,255,255,0.18)" }}
                >
                  {i < 2 ? <CheckCircle2 size={12} color="#C45C38" /> : <View className="w-2 h-2 rounded-full" style={{ backgroundColor: "#C4DAC0" }} />}
                </View>
                <Text className="text-xs" style={{ color: i < 2 ? "#C4DAC0" : "#96B496" }}>
                  {step}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}
