// Campus/Community tab — the default route at /timeline. General sites
// (siteInfo.vertical is neither 'institution' nor 'community') redirect
// straight to the Watch & Learn tab, same as the source never showing this
// half of the feed for them (see _layout.tsx's header comment).
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useTimeline } from "@/flow/TimelineContext";
import { useFlow } from "@/flow/FlowContext";
import CampusCommunityScreen from "@/screens/CampusCommunityScreen";

export default function TimelineIndexRoute() {
  const { siteResolved, isInstitution, isCommunity } = useTimeline();
  const flow = useFlow();
  const router = useRouter();
  const isGeneralSite = siteResolved && !isInstitution && !isCommunity;

  useEffect(() => {
    if (isGeneralSite) router.replace("/timeline/watch");
  }, [isGeneralSite]);

  function onBack() {
    router.replace(flow.timelineOrigin === "active" ? "/active" : "/packages");
  }

  if (!siteResolved || isGeneralSite) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#05140b" }}>
        <ActivityIndicator color="#c29d53" />
      </View>
    );
  }

  return <CampusCommunityScreen onBack={onBack} />;
}
