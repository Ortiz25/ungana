// Auth gate for the whole app/admin/* subtree. Wraps every admin route in
// AdminAuthProvider (scoped here, not the root layout — see its own header
// comment) and bounces to /admin/login whenever there's no session, except
// while already on the login route itself (that would be circular: the
// login screen is the one place you're allowed to have no token yet).
//
// This redirects imperatively from an effect rather than rendering a plain
// <Redirect> — <Redirect> re-evaluates (and re-fires router.replace) on
// every render of this component, and usePathname() itself re-renders this
// component on every navigation-state change, including the one *caused* by
// that same replace. On the logout → drawer → /admin/login transition that
// feedback loop was enough to blow through React's nested-update limit
// ("Maximum update depth exceeded"). An effect with a real dependency array
// only fires once per actual (isRestoring, token, onLoginRoute) transition,
// and keeps rendering the current screen (<Slot />) throughout instead of
// yanking the drawer subtree out immediately.
import { router, Slot, usePathname } from "expo-router";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { AdminAuthProvider, useAdminAuth } from "@/flow/AdminAuthContext";

function AdminGate() {
  const { token, isRestoring } = useAdminAuth();
  const pathname = usePathname();
  const onLoginRoute = pathname.endsWith("/login");

  useEffect(() => {
    if (!isRestoring && !token && !onLoginRoute) router.replace("/admin/login");
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

export default function AdminLayout() {
  return (
    <AdminAuthProvider>
      <AdminGate />
    </AdminAuthProvider>
  );
}
