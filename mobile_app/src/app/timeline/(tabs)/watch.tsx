import { useRouter } from "expo-router";
import { useFlow } from "@/flow/FlowContext";
import WatchEarnScreen from "@/screens/WatchEarnScreen";

export default function WatchRoute() {
  const flow = useFlow();
  const router = useRouter();

  function onBack() {
    router.replace(flow.timelineOrigin === "active" ? "/active" : "/packages");
  }

  return <WatchEarnScreen onBack={onBack} />;
}
