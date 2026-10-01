import { router } from "expo-router";
import PaymentScreen from "@/screens/PaymentScreen";
import { useFlow } from "@/flow/FlowContext";

export default function PaymentRoute() {
  const flow = useFlow();
  return (
    <PaymentScreen
      pkg={flow.selectedPkg}
      activator={flow.selectedActivator}
      onBack={() => router.replace("/packages")}
      onPay={(p, fail, reference) => {
        flow.setPhone(p);
        flow.setSimulatePaymentFailure(fail);
        flow.setPaymentReference(reference);
        flow.setExpectRealSession(true); // defensive — could still be false left over from an earlier demo-only earn attempt
        router.replace("/initiated");
      }}
      onBtcPaid={() => {
        // Polling already confirmed settlement inside PaymentScreen itself —
        // go straight to connecting, same as the watch-to-earn flow skips a
        // payment step.
        flow.setPhone("BTC");
        flow.setActiveInitialRemaining(null);
        flow.setExpectRealSession(true);
        router.replace("/connecting");
      }}
    />
  );
}
