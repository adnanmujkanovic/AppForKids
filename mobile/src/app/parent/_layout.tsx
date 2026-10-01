import { Redirect, Stack } from "expo-router";
import { useSession } from "../../lib/session";
import { C, Loading } from "../../components/ui";

export default function ParentLayout() {
  const { me, ready } = useSession();
  if (!ready || !me) return <Loading />;
  if (me.role !== "parent") return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTitleStyle: { fontWeight: "900" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: C.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Parent area" }} />
      <Stack.Screen name="add-child" options={{ title: "Add a child" }} />
      <Stack.Screen name="child/[id]" options={{ title: "Settings" }} />
      <Stack.Screen name="connectors" options={{ title: "Contacts & connectors" }} />
    </Stack>
  );
}
