import { router } from "expo-router";
import { Wallet } from "lucide-react-native";
import AssistantScreen from "@/screens/AssistantScreen";
import { useFlow } from "@/flow/FlowContext";
import { formatMinutesLabel } from "@/flow/WatchEarnContext";

export default function AssistantRoute() {
  const flow = useFlow();
  return (
    <AssistantScreen
      onBack={() => router.back()}
      onPurchaseConfirmed={({ phone, reference, packageId, packageLabel, priceKes, durationSecs }) => {
        // Same handoff app/payment.tsx's onPay does — InitiatedScreen (shows
        // the "check your phone" messaging) -> ConnectingScreen, which polls
        // /api/verify-payment/:reference the normal way. The assistant only
        // ever reaches this prop after a real confirmed charge (see
        // AssistantScreen's handleConfirmPurchase) — never on its own.
        flow.setSelectedPkg({ id: packageId, label: packageLabel, duration: formatMinutesLabel(durationSecs), price: priceKes, icon: Wallet, badge: null, demoSecs: durationSecs });
        flow.setPhone(phone);
        flow.setPaymentReference(reference);
        flow.setSimulatePaymentFailure(false);
        flow.setExpectRealSession(true);
        router.replace("/initiated");
      }}
    />
  );
}
