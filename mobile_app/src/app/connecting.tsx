import { router } from "expo-router";
import ConnectingScreen from "@/screens/ConnectingScreen";
import { useFlow } from "@/flow/FlowContext";
import { getSessionStatus } from "@/lib/api";
import { getClientMac, hasKnownIdentity } from "@/lib/device";
import type { SessionData } from "@/flow/sessionHelpers";

export default function ConnectingRoute() {
  const flow = useFlow();

  return (
    <ConnectingScreen
      onConnected={async () => {
        // The router auth this just completed may have folded in leftover
        // time from a still-active prior session — re-read the real expiry
        // instead of trusting selectedPkg.demoSecs alone. Skipped for the
        // pure local/demo shortcut (expectRealSession false), so that can't
        // accidentally pick up some unrelated *earlier* real session for
        // this mac.
        flow.setActiveInitialRemaining(null);
        if (flow.expectRealSession && hasKnownIdentity()) {
          const result = await getSessionStatus(getClientMac()!);
          const data = result.data as SessionData | undefined;
          if (result.ok && data?.active && data.expiresAt) {
            const serverNow = data.serverNow ?? Date.now();
            const remaining = Math.max(0, Math.round((data.expiresAt - serverNow) / 1000));
            flow.setActiveInitialRemaining(remaining);
            // ActiveScreen's ring treats pkg.demoSecs as the 100% mark — it
            // must match this real total, or a just-extended session
            // renders a ring stuck past full.
            flow.setSelectedPkg((p) => ({ ...p, demoSecs: remaining }));
          }
        }
        flow.setCameFromConnecting(true); // fresh payment just confirmed — safe to auto-trigger the online state
        router.replace("/active");
      }}
    />
  );
}
