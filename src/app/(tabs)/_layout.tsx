import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/lib/theme";

// Bottom tabs are the app's primary navigation per the standard:
// Enhance (the identity of the app, first) | Library | Templates | Collections | Account.
export default function TabLayout() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.panelEdge,
        },
        tabBarActiveTintColor: colors.violet,
        tabBarInactiveTintColor: colors.lumenDim,
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Enhance",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="albums" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          title: "Templates",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="collections"
        options={{
          title: "Collections",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
