import { router } from "expo-router";
import CoordinatorLoginScreen from "@/screens/coordinator/CoordinatorLoginScreen";
import { useCoordinatorAuth } from "@/flow/CoordinatorAuthContext";
import type { CoordinatorProfile } from "@/lib/coordinatorApi";

export default function CoordinatorLoginRoute() {
  const coordinatorAuth = useCoordinatorAuth();

  async function handleLogin(token: string, coordinator: CoordinatorProfile) {
    await coordinatorAuth.login(token, coordinator);
    router.replace("/coordinator/dashboard");
  }

  return <CoordinatorLoginScreen onLogin={handleLogin} onBack={() => router.replace("/packages")} />;
}
