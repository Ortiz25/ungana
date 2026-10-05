// Root-mounted floating entry point to the AI assistant — visible on
// Packages and the Watch & Earn/Campus-Community tab group (not on
// Payment/Active/Admin/etc.), when the current site has it enabled. Mounted
// at the root (see app/_layout.tsx) rather than duplicated inside each
// screen because /packages and /timeline/* are sibling routes with no
// shared layout between them — one overlay above both, same "one shared
// thing, not two copies" reasoning as WatchEarnOverlays.
import { useEffect, useRef, useState } from "react";
import { Pressable, View, Animated, Easing } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bot } from "lucide-react-native";
import { getSite } from "@/lib/api";
import { getSiteId } from "@/lib/device";
import { useAssistantBubbleHidden } from "@/lib/assistantBubbleStore";

// Only these — not Payment/Active/Admin/etc. ActiveScreen keeps its own
// inline Support row rather than this bubble, so the two never compete for
// the same screen.
function isAllowedRoute(pathname: string): boolean {
  return pathname === "/packages" || pathname === "/timeline" || pathname.startsWith("/timeline/");
}

export default function AssistantBubble() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const viewerHidden = useAssistantBubbleHidden();
  const [assistantEnabled, setAssistantEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const site = getSiteId();
      if (!site) return;
      const result = await getSite(site);
      if (result.ok && result.data?.site) setAssistantEnabled(!!result.data.site.assistantEnabled);
    })();
  }, []);

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.35, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  if (!assistantEnabled || !isAllowedRoute(pathname) || viewerHidden) return null;

  // The Watch & Earn/Campus tab group shows a native bottom tab bar for
  // institution/community sites (hidden for general sites — see
  // (tabs)/_layout.tsx) — clearing for it unconditionally on /timeline/*
  // is simpler than threading that visibility up to this root-level
  // component, and a little extra breathing room on general sites is
  // harmless.
  const extraClearance = pathname.startsWith("/timeline") ? 62 : 0;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
      <Pressable
        onPress={() => router.push("/assistant")}
        className="absolute items-center justify-center rounded-full active:scale-90"
        style={{
          right: 18,
          bottom: insets.bottom + 18 + extraClearance,
          width: 56,
          height: 56,
          backgroundColor: "#C45C38",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Animated.View pointerEvents="none" className="absolute rounded-full" style={{ width: 56, height: 56, backgroundColor: "#C45C38", opacity: 0.35, transform: [{ scale: pulse }] }} />
        <Bot size={24} color="#fff" />
      </Pressable>
    </View>
  );
}
