// One Drawer.Screen per built admin section, generated from the same
// ADMIN_NAV_ITEMS list AdminDrawerContent renders — one source of truth so
// the two can't drift out of sync. Uses expo-router's bundled Drawer (no new
// dependency — reanimated/worklets/gesture-handler are already installed)
// with a fully custom drawerContent (see AdminDrawerContent.tsx) so the nav
// panel matches the web sidebar's layout (compact width, sign-out pinned to
// the bottom) rather than the library's default DrawerItemList look.
import { Drawer } from "expo-router/drawer";
import AdminDrawerContent, { ADMIN_NAV_ITEMS } from "@/components/admin/AdminDrawerContent";

export default function AdminDrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <AdminDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: "#1D3C2A" },
        headerTintColor: "#E8D4B0",
        headerTitleStyle: { fontWeight: "700" },
        // Web's uncollapsed sidebar is w-64 (256px) — the library's own
        // default drawer width runs noticeably wider than that on most
        // phones, which read as oversized next to this app's otherwise
        // compact chrome.
        drawerStyle: { backgroundColor: "#2E5A3E", width: 240 },
      }}
    >
      {ADMIN_NAV_ITEMS.map((item) => (
        <Drawer.Screen key={item.name} name={item.name} options={{ title: item.label }} />
      ))}
    </Drawer>
  );
}
