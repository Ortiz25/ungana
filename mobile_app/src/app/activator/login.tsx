import { router } from "expo-router";
import ActivatorLoginScreen from "@/screens/activator/ActivatorLoginScreen";
import { useActivatorAuth } from "@/flow/ActivatorAuthContext";
import type { ActivatorProfile } from "@/lib/activatorApi";

export default function ActivatorLoginRoute() {
  const activatorAuth = useActivatorAuth();

  async function handleLogin(token: string, activator: ActivatorProfile) {
    await activatorAuth.login(token, activator);
    router.replace("/activator/dashboard");
  }

  return <ActivatorLoginScreen onLogin={handleLogin} onBack={() => router.replace("/packages")} />;
}
