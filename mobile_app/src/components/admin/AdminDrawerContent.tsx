// Ported from AdminDashboardScreen.svelte's <aside> sidebar: header badge +
// username, a scrollable nav list with the same active/inactive pill style,
// and a sign-out button pinned to the bottom behind a border-top separator
// — replacing expo-router/drawer's default DrawerItemList (which has no
// equivalent "pinned footer" slot) with a fully custom drawerContent so the
// mobile admin section matches the web sidebar's layout, not just its colors.
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DrawerContentScrollView, type DrawerContentComponentProps } from "expo-router/drawer";
import { ShieldCheck, LogOut, TrendingUp, Film, GraduationCap, MessageSquare, Zap, Radio, Settings, type LucideIcon } from "lucide-react-native";
import { useAdminAuth } from "@/flow/AdminAuthContext";

export type AdminNavItem = { name: string; label: string; icon: LucideIcon };

// Single source of truth for both the drawer's nav list (below) and
// (drawer)/_layout.tsx's Drawer.Screen registration — order matches the web
// sidebar's own TABS array.
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { name: "analytics", label: "Analytics", icon: TrendingUp },
  { name: "content", label: "Content", icon: Film },
  { name: "campus", label: "Campus", icon: GraduationCap },
  { name: "community", label: "Community", icon: MessageSquare },
  { name: "activators", label: "Activators", icon: Zap },
  { name: "coordinators", label: "Coordinators", icon: ShieldCheck },
  { name: "sites", label: "Sites & Packages", icon: Radio },
  { name: "settings", label: "Settings", icon: Settings },
];

export default function AdminDrawerContent(props: DrawerContentComponentProps) {
  const { admin, logout } = useAdminAuth();
  const insets = useSafeAreaInsets();
  const activeRouteName = props.state.routes[props.state.index]?.name;

  return (
    <View className="flex-1" style={{ backgroundColor: "#2E5A3E" }}>
      <View className="flex-row items-center gap-2.5 px-4" style={{ paddingTop: insets.top + 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
        <View className="w-9 h-9 rounded-2xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.35)", borderWidth: 1, borderColor: "rgba(196,92,56,0.35)" }}>
          <ShieldCheck size={16} color="#C45C38" />
        </View>
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[9px] font-sans-semibold uppercase" style={{ color: "#96B496", letterSpacing: 1 }}>
              Admin
            </Text>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#4E8050" }} />
          </View>
          <Text numberOfLines={1} className="text-sm font-bold" style={{ color: "#E8D4B0" }}>
            {admin?.username ?? ""}
          </Text>
        </View>
      </View>

      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 4 }}>
        {props.state.routes.map((route) => {
          const item = ADMIN_NAV_ITEMS.find((i) => i.name === route.name);
          if (!item) return null;
          const focused = route.name === activeRouteName;
          const Icon = item.icon;
          return (
            <Pressable
              key={route.key}
              onPress={() => props.navigation.navigate(route.name)}
              className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ backgroundColor: focused ? "rgba(196,92,56,0.22)" : "transparent", borderWidth: 1, borderColor: focused ? "rgba(196,92,56,0.35)" : "transparent" }}
            >
              <Icon size={16} color={focused ? "#C45C38" : "#C4DAC0"} />
              <Text className="text-sm font-sans-semibold" style={{ color: focused ? "#E8D4B0" : "#C4DAC0" }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </DrawerContentScrollView>

      <View className="p-3" style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", paddingBottom: insets.bottom + 12 }}>
        <Pressable onPress={logout} className="w-full flex-row items-center gap-2.5 px-3.5 py-2.5 rounded-xl active:opacity-80" style={{ backgroundColor: "rgba(184,80,56,0.12)" }}>
          <LogOut size={15} color="#E08A6A" />
          <Text className="text-sm font-sans-semibold" style={{ color: "#E08A6A" }}>
            Sign out
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
