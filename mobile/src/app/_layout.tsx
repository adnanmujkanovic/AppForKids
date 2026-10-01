import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "../lib/session";
import { RewardsProvider } from "../components/Rewards";
import { C } from "../components/ui";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <RewardsProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: C.bg },
              headerTintColor: C.ink,
              headerTitleStyle: { fontWeight: "900" },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: C.bg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ title: "Sign in" }} />
            <Stack.Screen name="register" options={{ title: "Create your family" }} />
            <Stack.Screen name="server" options={{ title: "Server", presentation: "modal" }} />
            <Stack.Screen name="parent" options={{ headerShown: false }} />
            <Stack.Screen name="kid" options={{ headerShown: false }} />
            <Stack.Screen name="s/[token]" options={{ title: "Shared creation" }} />
          </Stack>
        </RewardsProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
