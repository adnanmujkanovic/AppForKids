import { router, type Href } from "expo-router";
import { Text, View } from "react-native";
import { api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { Button, C, Card, Chip, ErrorText, H2, Loading, Muted, Row, Screen } from "../../components/ui";
import { MISSIONS } from "../../../../shared/types";

interface MissionState { id: string; steps: { done: boolean }[]; complete: boolean; current: number }

const STEP_LINKS: Record<string, string> = {
  ask: "/kid/explore", image: "/kid/create", game: "/kid/build", gamekind: "/kid/build", app: "/kid/apps", aiguide: "/kid/apps",
  detective: "/kid/detective", played: "/kid/mine", codeproject: "/kid/code", codechanged: "/kid/mine", coderan: "/kid/mine",
  friendsent: "/kid/mine", team: "/kid/friends", taskdone: "/kid/friends", version: "/kid/mine", deployed: "/kid/mine",
};

export default function Missions() {
  const { data, error } = useLoad(() => api.get<MissionState[]>("/kid/missions"));
  if (!data) return error ? <Screen><ErrorText error={error} /></Screen> : <Loading />;
  return (
    <Screen>
      <Muted>Guided challenges. Steps complete themselves when you do them for real — anywhere in SparkForge.</Muted>
      {MISSIONS.map((m) => {
        const st = data.find((x) => x.id === m.id);
        if (!st) return null;
        const done = st.steps.filter((x) => x.done).length;
        return (
          <Card key={m.id} tint={st.complete ? "mint" : undefined}>
            <Row style={{ justifyContent: "space-between" }}>
              <H2 style={{ flex: 1 }}>{m.emoji} {m.title}</H2>
              <Chip tone={st.complete ? "mint" : "gray"} label={st.complete ? "🏅 Complete!" : `${done}/${m.steps.length}`} />
            </Row>
            <Muted>{m.about}</Muted>
            <View style={{ height: 10, backgroundColor: C.line, borderRadius: 5, overflow: "hidden" }}>
              <View style={{ width: `${(done / m.steps.length) * 100}%`, height: "100%", backgroundColor: C.violet }} />
            </View>
            {m.steps.map((x, i) => {
              const ok = st.steps[i]?.done;
              const now = i === st.current;
              const link = STEP_LINKS[x.check.split(":")[0]];
              return (
                <View key={i} style={{ backgroundColor: ok ? C.mintSoft : now ? C.violetSoft : C.bg, borderRadius: 12, padding: 10, gap: 4 }}>
                  <Text style={{ fontWeight: "900" }}>{ok ? "✅" : now ? "👉" : "⬜"} Level {i + 1} — {x.title}</Text>
                  <Muted>{x.task}</Muted>
                  {now && link ? <Button size="sm" title="Go" onPress={() => router.push(link as Href)} style={{ alignSelf: "flex-start" }} /> : null}
                </View>
              );
            })}
            <Row>{m.skills.map((k) => <Chip key={k} tone="sky" label={k} />)}</Row>
          </Card>
        );
      })}
    </Screen>
  );
}
