// Campus/Community + Watch & Learn tab group — mirrors TimelineScreen.svelte's
// segmented top toggle (`campusView`), but rendered as a real Expo Router
// `Tabs` navigator per the user's explicit instruction to use file-based
// tabs. One deliberate deviation from the source: React Navigation's bottom-
// tabs (what Expo Router's <Tabs> wraps) renders at the bottom of the screen,
// not as a top segmented pill — reproducing the exact top placement would
// mean dropping to a custom navigator, disproportionate for what should
// otherwise read as a straight port. Colors/icons match the source exactly.
//
// General sites (siteInfo.vertical is neither 'institution' nor 'community')
// never showed this tab bar on the web either — they go straight to Watch &
// Learn with no tab chrome, reproduced below by hiding the bar and
// redirecting off `index` (see index.tsx).
//
// Also hidden while the content viewer is open (isViewerOpen) — the source's
// viewer is a full-screen takeover with no tab chrome at all, not just no
// header (see WatchEarnScreen.tsx / WatchEarnOverlays.tsx).
import { Tabs } from "expo-router";
import { GraduationCap, Users, Play } from "lucide-react-native";
import { useTimeline } from "@/flow/TimelineContext";
import { useWatchEarn } from "@/flow/WatchEarnContext";

export default function TimelineTabsLayout() {
  const { siteResolved, isInstitution, isCommunity } = useTimeline();
  const { isViewerOpen } = useWatchEarn();
  const showTabs = siteResolved && (isInstitution || isCommunity) && !isViewerOpen;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#E8D4B0",
        tabBarInactiveTintColor: "#6B8A6B",
        tabBarStyle: showTabs
          ? { backgroundColor: "#1D3C2A", borderTopColor: "rgba(255,255,255,0.08)", borderTopWidth: 1 }
          : { display: "none" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isCommunity ? "Community" : "Campus",
          tabBarIcon: ({ color, size }) => (isCommunity ? <Users size={size} color={color} /> : <GraduationCap size={size} color={color} />),
        }}
      />
      <Tabs.Screen
        name="watch"
        options={{
          title: "Watch & Learn",
          tabBarIcon: ({ color, size }) => <Play size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
