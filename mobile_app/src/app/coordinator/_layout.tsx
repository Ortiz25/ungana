// Auth gate for app/coordinator/* — same shape as app/activator/_layout.tsx
// / app/admin/_layout.tsx.
import { router, Slot, usePathname } from "expo-router";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { CoordinatorAuthProvider, useCoordinatorAuth } from "@/flow/CoordinatorAuthContext";

function CoordinatorGate() {
  const { token, isRestoring } = useCoordinatorAuth();
  const pathname = usePathname();
  const onLoginRoute = pathname.endsWith("/login");

  useEffect(() => {
    if (!isRestoring && !token && !onLoginRoute) router.replace("/coordinator/login");
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

export default function CoordinatorLayout() {
  return (
    <CoordinatorAuthProvider>
      <CoordinatorGate />
    </CoordinatorAuthProvider>
  );
}
