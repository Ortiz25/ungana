// Ambient, no-typing-required way of telling a guest "you already have time
// running" on screens they might land on without realizing it — a compact
// round-ish badge (icon + time left), not a full banner, so it reads as a
// small status indicator rather than competing with the actual page content.
// Placed top-right of Packages and top-middle of the Earn Free Access header
// (see those call sites) — both float it over/alongside the existing header
// rather than taking its own row. Complements rather than replaces
// check-session.tsx's manual by-username lookup: this is purely mac-based
// and silent, so it only ever fires for a device whose mac the app already
// knows (hasKnownIdentity()) — a device with no identity yet still needs the
// manual form, same as today.
import { useEffect, useState } from "react";
import { Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Wifi } from "lucide-react-native";
import { getSessionStatus } from "@/lib/api";
import { getClientMac, hasKnownIdentity } from "@/lib/device";
import { useFlow } from "@/flow/FlowContext";
import { applySessionData, type SessionData } from "@/flow/sessionHelpers";

// Deliberately terse (no spaces, hours OR minutes not both) — this has to
// fit under an 18px icon in a ~56px-wide badge.
function formatRemainingCompact(secs: number): string {
  const h = Math.floor(secs / 3600);
  if (h > 0) return `${h}h`;
  const m = Math.max(1, Math.round(secs / 60));
  return `${m}m`;
}

const VARIANTS = {
  light: { bg: "rgba(78,128,80,0.12)", border: "rgba(78,128,80,0.3)", icon: "#2E7D52", label: "#2E7D52" },
  dark: { bg: "rgba(78,128,80,0.18)", border: "rgba(126,200,142,0.4)", icon: "#7EC88E", label: "#7EC88E" },
};

export default function ActiveSessionBanner({ variant = "light" }: { variant?: "light" | "dark" }) {
  const flow = useFlow();
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  // Computed once, in the effect, from the same serverNow the session data
  // itself arrived with — Date.now() is an impure call, not allowed directly
  // in the render body (React's purity rule), so this can't be derived at
  // render time the way a "live" countdown would.
  const [remainingSecs, setRemainingSecs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasKnownIdentity()) return;
      const result = await getSessionStatus(getClientMac()!);
      if (cancelled) return;
      const data = result.ok ? (result.data as SessionData) : null;
      if (data?.found && data.active) {
        setSession(data);
        const serverNow = data.serverNow ?? Date.now();
        setRemainingSecs(data.expiresAt ? Math.max(0, Math.round((data.expiresAt - serverNow) / 1000)) : null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!session) return null;

  const colors = VARIANTS[variant];

  function onPress() {
    const target = applySessionData(flow, session!);
    router.replace(target ?? "/active");
  }

  return (
    <Pressable
      onPress={onPress}
      className="items-center active:scale-95"
      style={{ width: 52, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, gap: 2 }}
    >
      <Wifi size={16} color={colors.icon} />
      <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: "700", color: colors.label }}>
        {remainingSecs != null ? formatRemainingCompact(remainingSecs) : "Active"}
      </Text>
    </Pressable>
  );
}
