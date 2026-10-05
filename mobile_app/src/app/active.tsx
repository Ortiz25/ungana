import { router } from "expo-router";
import ActiveScreen from "@/screens/ActiveScreen";
import { useFlow } from "@/flow/FlowContext";
import { getWarningThreshold } from "@/lib/data";
import { clearIdentity } from "@/lib/device";
import { clearAssistantChat } from "@/lib/assistantStorage";

export default function ActiveRoute() {
  const flow = useFlow();
  return (
    <ActiveScreen
      pkg={flow.selectedPkg}
      phone={flow.phone}
      mode={flow.appMode}
      initialRemaining={flow.activeInitialRemaining}
      onExpiring={() => {
        flow.setWarningRemaining(getWarningThreshold(flow.selectedPkg.demoSecs));
        router.replace("/warning");
      }}
      onExtend={() => router.replace("/packages")}
      onExplore={() => {
        flow.setTimelineOrigin("active");
        router.replace("/timeline");
      }}
      onSupport={() => router.push("/assistant")}
      onLogout={async () => {
        // Forgets this device (mac/site/username — see device.ts) so it's
        // no longer auto-recognized, and drops the one identifying bit of
        // in-memory flow state (phone) so it can't linger on screen for
        // whoever uses this phone next. index.tsx's own identity check
        // then naturally routes a now-identity-less device to check-session.
        await clearIdentity();
        await clearAssistantChat();
        flow.setPhone("");
        router.replace("/");
      }}
    />
  );
}
