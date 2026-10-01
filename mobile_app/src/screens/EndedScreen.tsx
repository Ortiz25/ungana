// Ported from frontend/src/lib/screens/EndedScreen.svelte.
import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { WifiOff, RotateCcw, MessageCircle } from "lucide-react-native";
import ScreenBg from "@/components/ScreenBg";
import type { Package } from "@/lib/data";

export default function EndedScreen({
  pkg,
  phone,
  onBuyAgain,
}: {
  pkg: Package;
  phone: string;
  onBuyAgain: () => void;
}) {
  const rows = [
    { label: "Plan used", value: `${pkg.label} · ${pkg.duration}` },
    { label: "Number", value: `+254 ${phone}` },
    { label: "Amount paid", value: `${pkg.price.toLocaleString()} KES` },
    { label: "Status", value: "Completed ✓" },
  ];

  // Same "draw the eye back to the CTA" breathing-scale + expanding pulse
  // ring as the source's CSS keyframes, via RN's built-in Animated API (no
  // extra dependency needed for one looping effect).
  const scale = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.035, duration: 1200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(ringScale, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0.45, duration: 0, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.25, duration: 2400, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0, duration: 2400, useNativeDriver: true }),
        ]),
      ])
    );
    breathe.start();
    ring.start();
    return () => {
      breathe.stop();
      ring.stop();
    };
  }, [scale, ringScale, ringOpacity]);

  return (
    <ScreenBg className="items-center">
      <View className="items-center mt-8 mb-6">
        <View
          className="w-24 h-24 rounded-full items-center justify-center mb-4"
          style={{ backgroundColor: "rgba(46,90,62,0.12)", borderWidth: 2, borderColor: "rgba(46,90,62,0.25)" }}
        >
          <WifiOff size={44} color="#3C6A4A" strokeWidth={1.5} />
        </View>
        <View className="px-3 py-1 rounded-full mb-3" style={{ backgroundColor: "rgba(46,90,62,0.12)", borderWidth: 1, borderColor: "rgba(46,90,62,0.2)" }}>
          <Text className="text-xs font-sans-semibold uppercase tracking-widest" style={{ color: "#3C6A4A", letterSpacing: 1.5 }}>
            Session Ended
          </Text>
        </View>
        <Text className="text-2xl font-serif text-center" style={{ color: "#1D3C2A" }}>
          Your time is up
        </Text>
        <Text className="text-sm mt-1.5 text-center" style={{ color: "#3C6A4A" }}>
          Your {pkg.label} session has ended
        </Text>
      </View>

      <View className="w-full mb-2" style={{ position: "relative" }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: "rgba(196,92,56,0.45)",
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }}
        />
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            onPress={onBuyAgain}
            className="w-full py-4 rounded-2xl flex-row items-center justify-center gap-2 active:opacity-90"
            style={{ backgroundColor: "#C45C38" }}
          >
            <RotateCcw size={18} color="#fff" />
            <Text className="text-base font-sans-semibold text-white">Buy Another Session</Text>
          </Pressable>
        </Animated.View>
      </View>
      <Text className="text-xs text-center mb-5" style={{ color: "#3C6A4A" }}>
        Stay connected with a new plan
      </Text>

      <View className="w-full rounded-3xl overflow-hidden mb-4" style={{ backgroundColor: "#2E5A3E" }}>
        <View className="px-5 pt-5 pb-4">
          <Text className="text-xs uppercase tracking-widest mb-3 font-sans-semibold" style={{ color: "#C4DAC0" }}>
            Session Summary
          </Text>
          {rows.map((row, i) => (
            <View
              key={row.label}
              className="flex-row justify-between items-center py-2.5"
              style={i < rows.length - 1 ? { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" } : undefined}
            >
              <Text className="text-xs" style={{ color: "#C4DAC0" }}>
                {row.label}
              </Text>
              <Text className="text-sm font-sans-semibold text-right" style={{ color: "#E8D4B0" }}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable className="w-full py-3.5 rounded-2xl flex-row items-center justify-center gap-2 mb-2" style={{ backgroundColor: "#1D3C2A" }}>
        <MessageCircle size={16} color="#E8D4B0" />
        <Text className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
          Contact Support
        </Text>
      </Pressable>

      <Text className="text-[10px] text-center mt-3" style={{ color: "#7A8868" }}>
        swap.ungana.app
      </Text>
    </ScreenBg>
  );
}
