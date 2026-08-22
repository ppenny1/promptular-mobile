import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
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
      </Stack>
    </>
  );
}
