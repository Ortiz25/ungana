import { router } from "expo-router";
import AdminLoginScreen from "@/screens/admin/AdminLoginScreen";
import { useAdminAuth } from "@/flow/AdminAuthContext";
import type { AdminInfo } from "@/lib/adminApi";

export default function AdminLoginRoute() {
  const adminAuth = useAdminAuth();

  async function handleLogin(token: string, admin: AdminInfo) {
    await adminAuth.login(token, admin);
    router.replace("/admin/(drawer)/analytics");
  }

  return <AdminLoginScreen onLogin={handleLogin} onBack={() => router.replace("/packages")} />;
}
