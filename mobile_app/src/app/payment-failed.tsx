import { router } from "expo-router";
import PaymentFailedScreen from "@/screens/PaymentFailedScreen";
import { useFlow } from "@/flow/FlowContext";

export default function PaymentFailedRoute() {
  const flow = useFlow();
  return (
    <PaymentFailedScreen
      pkg={flow.selectedPkg}
      phone={flow.phone}
      mode={flow.appMode}
      reason={flow.paymentFailReason}
      onRetry={() => router.replace("/payment")}
      onHome={() => router.replace("/packages")}
    />
  );
}
