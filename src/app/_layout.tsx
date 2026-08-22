import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useShareIntent } from "expo-share-intent";
import { colors } from "@/lib/theme";
import Banner from "@/components/Banner";

export default function RootLayout() {
  const router = useRouter();
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
      <StatusBar style="light" />
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
          options={{ presentation: "modal", contentStyle: { backgroundColor: colors.ink } }}
        />
        <Stack.Screen
          name="history"
          options={{ presentation: "modal", contentStyle: { backgroundColor: colors.ink } }}
        />
        <Stack.Screen
          name="collection/[id]"
          options={{ contentStyle: { backgroundColor: colors.ink } }}
        />
        <Stack.Screen
          name="help"
          options={{ presentation: "modal", contentStyle: { backgroundColor: colors.ink } }}
        />
        <Stack.Screen
          name="templates"
          options={{ presentation: "modal", contentStyle: { backgroundColor: colors.ink } }}
        />
      </Stack>
    </View>
  );
}
