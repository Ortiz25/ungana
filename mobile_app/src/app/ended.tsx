import { router } from "expo-router";
import EndedScreen from "@/screens/EndedScreen";
import { useFlow } from "@/flow/FlowContext";

export default function EndedRoute() {
  const flow = useFlow();
  return <EndedScreen pkg={flow.selectedPkg} phone={flow.phone} onBuyAgain={() => router.replace("/packages")} />;
}
