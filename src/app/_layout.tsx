import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShareIntent } from "expo-share-intent";
import { ThemeProvider, useColors, useTheme } from "@/lib/theme";
import Banner from "@/components/Banner";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const colors = useColors();
  const { resolved } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // iOS modals present as sheets below the status bar; Android modals are
  // full screen and slide under it, hiding each screen's header row. Pad
  // the top inset on Android only.
  const modalStyle = {
    backgroundColor: colors.ink,
    paddingTop: Platform.OS === "android" ? insets.top : 0,
  };
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  // Text shared to Promptular from any app lands in Enhance, ready to
  // improve. This is the share extension (iOS) / share target (Android).
  useEffect(() => {
    if (!hasShareIntent) return;
    const text = shareIntent?.text || shareIntent?.webUrl || "";
    if (text) {
      router.push({ pathname: "/(tabs)", params: { shared: text } });
    }
    resetShareIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <Banner />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ink },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="prompt/[id]"
          options={{ presentation: "modal", contentStyle: modalStyle }}
        />
        <Stack.Screen
          name="history"
          options={{ presentation: "modal", contentStyle: modalStyle }}
        />
        <Stack.Screen
          name="collection/[id]"
          options={{ contentStyle: { backgroundColor: colors.ink } }}
        />
        <Stack.Screen
          name="help"
          options={{ presentation: "modal", contentStyle: modalStyle }}
        />
      </Stack>
    </View>
  );
}
