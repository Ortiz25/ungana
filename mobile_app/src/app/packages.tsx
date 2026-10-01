import { Alert } from "react-native";
import { router } from "expo-router";
import PackageScreen from "@/screens/PackageScreen";
import { useFlow } from "@/flow/FlowContext";

export default function PackagesRoute() {
  const flow = useFlow();
  return (
    <PackageScreen
      mode={flow.appMode}
      onSelect={(pkg, activator) => {
        flow.setSelectedPkg(pkg);
        flow.setSelectedActivator(activator);
        router.replace("/payment");
      }}
      onEarnAccess={() => {
        flow.setTimelineOrigin("packages");
        router.replace("/timeline");
      }}
      onActivatorLogin={() => Alert.alert("Coming soon", "Activator sign-in is being added in a later phase.")}
      onCoordinatorLogin={() => Alert.alert("Coming soon", "Coordinator sign-in is being added in a later phase.")}
      onAdminLogin={() => router.replace("/admin/login")}
    />
  );
}
