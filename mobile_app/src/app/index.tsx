// Entry route — the mobile equivalent of +page.svelte's onMount: resolves
// app mode, then asks the backend whether this device's mac (already
// resolved by device.ts before this route even mounted — see
// app/_layout.tsx) has a session on record, and redirects accordingly. A
// mac that arrived via deep link *this launch* is trustworthy; a
// merely-cached one from a previous launch isn't by itself — see
// isMacFreshThisLaunch's comment in device.ts.
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { getAppInfo, getSessionStatus } from "@/lib/api";
import { getClientMac, hasKnownIdentity, isMacFreshThisLaunch } from "@/lib/device";
import { useFlow } from "@/flow/FlowContext";
import { applySessionData, type SessionData } from "@/flow/sessionHelpers";

export default function Index() {
  const flow = useFlow();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const infoResult = await getAppInfo();
      if (!cancelled && infoResult.ok && infoResult.data?.mode) flow.setAppMode(infoResult.data.mode);

      if (hasKnownIdentity()) {
        const result = await getSessionStatus(getClientMac()!);
        if (cancelled) return;
        if (result.ok && (result.data as SessionData)?.found) {
          const target = applySessionData(flow, result.data as SessionData);
          router.replace(target ?? "/packages");
        } else if (!isMacFreshThisLaunch()) {
          router.replace("/check-session");
        } else {
          router.replace("/packages");
        }
      } else {
        router.replace("/check-session");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#E8D4B0" }}>
      <ActivityIndicator color="#1D3C2A" />
    </View>
  );
}
