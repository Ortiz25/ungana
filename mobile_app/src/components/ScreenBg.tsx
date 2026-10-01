// Ported from frontend/src/lib/components/ScreenBg.svelte. CSS
// linear-gradient has no RN equivalent, hence expo-linear-gradient (the one
// new dependency this port needed beyond what the plan doc listed) —
// standard Expo SDK package, not a third-party addition.
import type { ReactNode } from "react";
import { ScrollView, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ScreenBg({
  children,
  className = "",
  scroll = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const verticalPadding = { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 };
  // For a ScrollView, vertical padding belongs on contentContainerStyle, not
  // style — style only affects the outer (fixed-size) viewport, so padding
  // there never extends how far the content can actually scroll. Putting it
  // on the outer style silently clipped/stranded content past the last
  // screen's worth of height (e.g. a bottom button past the fold became
  // unreachable no matter how far you scrolled).
  const Container = scroll ? ScrollView : View;
  const containerProps = scroll ? { contentContainerStyle: { flexGrow: 1, ...verticalPadding } } : {};

  return (
    <LinearGradient colors={["#E8D4B0", "#DBC89A"]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1 }}>
      <Container {...containerProps} className={`flex-1 px-5 ${className}`} style={[scroll ? null : verticalPadding, style]}>
        {children}
      </Container>
    </LinearGradient>
  );
}
