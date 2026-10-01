import { router } from "expo-router";
import Tabs from "expo-router/js-tabs";
import { Pressable, Text } from "react-native";
import { useSession } from "../../../lib/session";
import { C } from "../../../components/ui";

const icon = (emoji: string) => ({ focused }: { focused: boolean }) => <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>;

export default function KidTabs() {
  const { me } = useSession();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTitleStyle: { fontWeight: "900" },
        headerShadowVisible: false,
        tabBarActiveTintColor: C.violet,
        tabBarInactiveTintColor: C.ink3,
        tabBarLabelStyle: { fontWeight: "800" },
        sceneStyle: { backgroundColor: C.bg },
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Grown-ups"
            onPress={() => router.push({ pathname: "/login", params: { grownup: "1" } })}
            style={{ marginRight: 14, padding: 6, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: C.line }}
          >
            <Text>👪</Text>
          </Pressable>
        ),
        headerLeft: () => (
          <Pressable accessibilityRole="button" accessibilityLabel="My Creator Passport" onPress={() => router.push("/kid/passport")} style={{ marginLeft: 14 }}>
            <Text style={{ fontSize: 24 }}>{me?.child?.avatar ?? "🧒"}</Text>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", headerTitle: "SparkForge", tabBarIcon: icon("🏠") }} />
      <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: icon("🔭") }} />
      <Tabs.Screen name="create" options={{ title: "Create", tabBarIcon: icon("🎨") }} />
      <Tabs.Screen name="build" options={{ title: "Build", tabBarIcon: icon("🎮") }} />
      <Tabs.Screen name="mine" options={{ title: "Mine", tabBarIcon: icon("📦") }} />
    </Tabs>
  );
}
