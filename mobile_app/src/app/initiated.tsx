import { router } from "expo-router";
import InitiatedScreen from "@/screens/InitiatedScreen";
import { useFlow } from "@/flow/FlowContext";

export default function InitiatedRoute() {
  const flow = useFlow();
  return (
    <InitiatedScreen
      pkg={flow.selectedPkg}
      phone={flow.phone}
      activator={flow.selectedActivator}
      willFail={flow.simulatePaymentFailure}
      reference={flow.paymentReference}
      mode={flow.appMode}
      onContinue={() => router.replace("/connecting")}
      onFailed={(reason) => {
        flow.setPaymentFailReason(reason);
        router.replace("/payment-failed");
      }}
    />
  );
}
