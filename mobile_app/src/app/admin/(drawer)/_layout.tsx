// One Drawer.Screen per built admin section, ordered to match the web
// sidebar's own nav array. Uses expo-router/drawer's bundled Drawer (needs
// no new dependency — reanimated/worklets/gesture-handler are already
// installed) rather than a custom side-nav, since this is internal staff
// tooling where the default hamburger chrome is perfectly appropriate.
import { Drawer } from "expo-router/drawer";
import { Zap, LogOut, Radio, Film, GraduationCap, MessageSquare, TrendingUp, ShieldCheck, Settings } from "lucide-react-native";
import { Pressable } from "react-native";
import { useAdminAuth } from "@/flow/AdminAuthContext";

function LogoutButton() {
  const { logout } = useAdminAuth();
  return (
    <Pressable onPress={logout} hitSlop={12} style={{ marginRight: 16 }}>
      <LogOut size={18} color="#E8D4B0" />
    </Pressable>
  );
}

export default function AdminDrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerStyle: { backgroundColor: "#1D3C2A" },
        headerTintColor: "#E8D4B0",
        headerTitleStyle: { fontWeight: "700" },
        drawerActiveTintColor: "#C45C38",
        drawerInactiveTintColor: "#C4DAC0",
        drawerStyle: { backgroundColor: "#2E5A3E" },
        headerRight: () => <LogoutButton />,
      }}
    >
      <Drawer.Screen
        name="analytics"
        options={{ title: "Analytics", drawerIcon: ({ color, size }) => <TrendingUp size={size} color={color} /> }}
      />
      <Drawer.Screen
        name="content"
        options={{ title: "Content", drawerIcon: ({ color, size }) => <Film size={size} color={color} /> }}
      />
      <Drawer.Screen
        name="campus"
        options={{ title: "Campus", drawerIcon: ({ color, size }) => <GraduationCap size={size} color={color} /> }}
      />
      <Drawer.Screen
        name="community"
        options={{ title: "Community", drawerIcon: ({ color, size }) => <MessageSquare size={size} color={color} /> }}
      />
      <Drawer.Screen
        name="activators"
        options={{ title: "Activators", drawerIcon: ({ color, size }) => <Zap size={size} color={color} /> }}
      />
      <Drawer.Screen
        name="coordinators"
        options={{ title: "Coordinators", drawerIcon: ({ color, size }) => <ShieldCheck size={size} color={color} /> }}
      />
      <Drawer.Screen
        name="sites"
        options={{ title: "Sites & Packages", drawerIcon: ({ color, size }) => <Radio size={size} color={color} /> }}
      />
      <Drawer.Screen
        name="settings"
        options={{ title: "Settings", drawerIcon: ({ color, size }) => <Settings size={size} color={color} /> }}
      />
    </Drawer>
  );
}
