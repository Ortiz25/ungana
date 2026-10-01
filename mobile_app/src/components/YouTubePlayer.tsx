// Ported from TimelineScreen.svelte's YouTube IFrame Player API $effect
// (script lines ~864-965). RN has no native YouTube embed, so this reuses
// the *real* YouTube IFrame Player API inside a WebView (react-native-webview
// is already a dependency, already used the same way for PaymentScreen's BTC
// checkout iframe) rather than reimplementing playback tracking natively —
// same onStateChange + polled getCurrentTime() approach as the source,
// bridged back out via postMessage.
import { useMemo } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

function buildHtml(videoId: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>html,body,#player{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden;}</style>
</head>
<body>
  <div id="player"></div>
  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    var player = null;
    var pollTimer = null;
    function post(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        videoId: '${videoId}',
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onStateChange: function (e) {
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
            if (e.data !== YT.PlayerState.PLAYING) return;
            pollTimer = setInterval(function () {
              if (!player) { clearInterval(pollTimer); pollTimer = null; return; }
              post({ type: 'time', secs: player.getCurrentTime() });
            }, 250);
          },
        },
      });
    }
  </script>
</body>
</html>`;
}

export default function YouTubePlayer({ videoId, onProgress }: { videoId: string; onProgress: (secs: number) => void }) {
  const html = useMemo(() => buildHtml(videoId), [videoId]);

  function handleMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === "time" && typeof msg.secs === "number") onProgress(msg.secs);
    } catch {
      // ignore malformed bridge messages
    }
  }

  return (
    <View className="w-full h-full">
      <WebView
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        style={{ backgroundColor: "#000" }}
      />
    </View>
  );
}
