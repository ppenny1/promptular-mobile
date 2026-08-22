import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { colors } from "@/lib/theme";
import Banner from "@/components/Banner";

export default function RootLayout() {
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
