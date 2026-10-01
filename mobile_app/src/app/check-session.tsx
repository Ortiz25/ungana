import { Alert } from "react-native";
import { router } from "expo-router";
import CheckSessionScreen from "@/screens/CheckSessionScreen";
import { useFlow } from "@/flow/FlowContext";
import { applySessionData, type SessionData } from "@/flow/sessionHelpers";

export default function CheckSessionRoute() {
  const flow = useFlow();
  return (
    <CheckSessionScreen
      onFound={(data: SessionData) => {
        const target = applySessionData(flow, data);
        router.replace(target ?? "/packages");
      }}
      onSkip={() => router.replace("/packages")}
      onActivatorLogin={() => Alert.alert("Coming soon", "Activator sign-in is being added in a later phase.")}
      onCoordinatorLogin={() => Alert.alert("Coming soon", "Coordinator sign-in is being added in a later phase.")}
      onAdminLogin={() => router.replace("/admin/login")}
    />
  );
}
