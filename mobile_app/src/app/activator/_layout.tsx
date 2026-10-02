// Auth gate for app/activator/* — same shape and reasoning as
// app/admin/_layout.tsx (see its header comment for why this redirects
// imperatively from an effect rather than rendering a plain <Redirect>).
import { router, Slot, usePathname } from "expo-router";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { ActivatorAuthProvider, useActivatorAuth } from "@/flow/ActivatorAuthContext";

function ActivatorGate() {
  const { token, isRestoring } = useActivatorAuth();
  const pathname = usePathname();
  const onLoginRoute = pathname.endsWith("/login");

  useEffect(() => {
    if (!isRestoring && !token && !onLoginRoute) router.replace("/activator/login");
  }, [isRestoring, token, onLoginRoute]);

  if (isRestoring) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#1D3C2A" }}>
        <ActivityIndicator color="#c29d53" />
      </View>
    );
  }

  return <Slot />;
}

export default function ActivatorLayout() {
  return (
    <ActivatorAuthProvider>
      <ActivatorGate />
    </ActivatorAuthProvider>
  );
}
