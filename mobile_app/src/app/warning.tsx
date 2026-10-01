import { router } from "expo-router";
import WarningScreen from "@/screens/WarningScreen";
import { useFlow } from "@/flow/FlowContext";

export default function WarningRoute() {
  const flow = useFlow();
  return (
    <WarningScreen
      pkg={flow.selectedPkg}
      remaining={flow.warningRemaining}
      mode={flow.appMode}
      onExtend={() => router.replace("/packages")}
      onDismiss={() => router.replace("/ended")}
    />
  );
}
