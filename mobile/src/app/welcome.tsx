import { router } from "expo-router";
import { Text, View } from "react-native";
import { SceneView } from "../components/SceneView";
import { Button, C, Card, Chip, H1, Muted, P, Row, Screen } from "../components/ui";

const demo = {
  title: "Me on Mars",
  caption: "",
  style: "land" as const,
  sky: "#e8a36b",
  ground: "#b5532e",
  elements: [
    { emoji: "🌋", label: "Olympus Mons", x: 72, y: 50, size: 28 },
    { emoji: "🧑‍🚀", label: "Me!", x: 34, y: 66, size: 20 },
    { emoji: "🚙", label: "Rover", x: 52, y: 74, size: 14 },
    { emoji: "🪐", label: "", x: 16, y: 20, size: 12 },
  ],
};

export default function Welcome() {
  return (
    <Screen>
      <View style={{ height: 24 }} />
      <Row>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.violet, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 22 }}>✨</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: "900", color: C.ink }}>SparkForge Kids</Text>
      </Row>
      <Chip tone="sun" label="Ask. Create. Build. Share." />
      <H1>
        Kids turn curiosity into things they can proudly say: <Text style={{ color: C.violet }}>“I made this.”</Text>
      </H1>
      <P>Ask questions, make pictures and stories, build real games and apps, find and fix bugs — and learn engineering along the way.</P>
      <Card style={{ padding: 10 }}>
        <SceneView scene={demo} />
        <Muted style={{ textAlign: "center" }}>“Put me on Mars!” — made with SparkForge</Muted>
      </Card>
      <Button size="lg" title="Create a family account" onPress={() => router.push("/register")} />
      <Button size="lg" variant="ghost" title="Sign in" onPress={() => router.push("/login")} />
      <Muted style={{ textAlign: "center" }}>Parents set up SparkForge. Kids create.</Muted>
      <Button size="sm" variant="ghost" title="⚙️ Server settings" onPress={() => router.push("/server")} style={{ alignSelf: "center" }} />
    </Screen>
  );
}
