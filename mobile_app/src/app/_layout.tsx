// Root layout — font loading + device identity resolution (once, before
// anything else renders, same role as +page.svelte's onMount start), then
// a plain Stack of file-based routes. `headerShown: false` throughout: this
// app builds its own header chrome per-screen, same as the source. Every
// navigation in this app uses router.replace (see each route file) rather
// than .push, so the visible stack never grows past one entry — that's what
// gives us the source app's "no back-stack" behavior for free, without
// fighting the navigator for it.
import "../global.css";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
} from "@expo-google-fonts/playfair-display";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { initDeviceIdentity, applyDeepLink } from "@/lib/device";
import { FlowProvider } from "@/flow/FlowContext";

// Keeps the native splash (app.json's own splash config — same brand
// colors as the web app) up during font loading + device identity
// resolution below, instead of swapping to a plain ActivityIndicator view
// that would flash between two different-looking loading states.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_700Bold_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [identityReady, setIdentityReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const initialUrl = await Linking.getInitialURL();
      await initDeviceIdentity(initialUrl);
      if (!cancelled) setIdentityReady(true);
    })();

    // A deep link received while the app is already running — e.g. tapping
    // the web app's "Continue in the app" link again to switch which
    // session this device represents.
    const subscription = Linking.addEventListener("url", ({ url }) => {
      applyDeepLink(url);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded && identityReady) SplashScreen.hideAsync();
  }, [fontsLoaded, identityReady]);

  if (!fontsLoaded || !identityReady) return null;

  return (
    <SafeAreaProvider>
      <FlowProvider>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
      </FlowProvider>
    </SafeAreaProvider>
  );
}
