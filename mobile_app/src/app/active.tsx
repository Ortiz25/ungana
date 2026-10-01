import { router } from "expo-router";
import ActiveScreen from "@/screens/ActiveScreen";
import { useFlow } from "@/flow/FlowContext";
import { getWarningThreshold } from "@/lib/data";

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
    />
  );
}
