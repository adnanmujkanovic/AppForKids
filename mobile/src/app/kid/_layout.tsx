import { Redirect, Stack } from "expo-router";
import { useSession } from "../../lib/session";
import { C, Loading } from "../../components/ui";

export default function KidLayout() {
  const { me, ready } = useSession();
  if (!ready || !me) return <Loading />;
  if (me.role !== "child") return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTitleStyle: { fontWeight: "900" },
        headerShadowVisible: false,
        headerTintColor: C.ink,
        contentStyle: { backgroundColor: C.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="apps" options={{ title: "🛠️ Make an app" }} />
      <Stack.Screen name="learn" options={{ title: "📚 Learn" }} />
      <Stack.Screen name="missions" options={{ title: "🚀 Missions" }} />
      <Stack.Screen name="passport" options={{ title: "🏆 Creator Passport" }} />
      <Stack.Screen name="detective" options={{ title: "🕵️ AI Detective" }} />
      <Stack.Screen name="plans" options={{ title: "🗓️ Planner" }} />
      <Stack.Screen name="friends" options={{ title: "🤝 Friends" }} />
      <Stack.Screen name="feed" options={{ title: "🌍 Creator Feed" }} />
      <Stack.Screen name="code" options={{ title: "⌨️ Code Mode" }} />
      <Stack.Screen name="project/[id]" options={{ title: "" }} />
    </Stack>
  );
}
