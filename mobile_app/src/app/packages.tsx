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
      onCheckSession={() => router.replace("/check-session")}
      onActivatorLogin={() => router.replace("/activator/login")}
      onCoordinatorLogin={() => router.replace("/coordinator/login")}
      onAdminLogin={() => router.replace("/admin/login")}
    />
  );
}
