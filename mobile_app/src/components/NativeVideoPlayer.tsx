// Native (non-YouTube) video playback for the content viewer — ported from
// TimelineScreen.svelte's <video ontimeupdate={handleVideoTimeUpdate}>.
// expo-video's timeUpdate event (not a raw property read) is what actually
// triggers a re-render/callback on progress — see useEvent below.
import { useEffect } from "react";
import { View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";

export default function NativeVideoPlayer({ uri, onProgress }: { uri: string; onProgress: (secs: number) => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.timeUpdateEventInterval = 0.25;
    p.play();
  });
  const { currentTime } = useEvent(player, "timeUpdate", {
    currentTime: player.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });

  useEffect(() => {
    if (typeof currentTime === "number") onProgress(currentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime]);

  return (
    <View className="w-full h-full">
      <VideoView player={player} style={{ width: "100%", height: "100%" }} nativeControls contentFit="contain" />
    </View>
  );
}
