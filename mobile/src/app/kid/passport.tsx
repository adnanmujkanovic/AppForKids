import { useState } from "react";
import { Text, View } from "react-native";
import { api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { C, Card, Chip, ErrorText, H1, H2, Loading, Muted, Row, Screen } from "../../components/ui";
import { CONCEPTS, CREATOR_LEVELS, MEDALS } from "../../../../shared/types";

interface Passport {
  name: string;
  avatar: string;
  level: string;
  medals: { medal_id: string }[];
  skills: { concept: string }[];
  stats: { projects: number; games: number; apps: number; creations: number; bugsFixed: number; shares: number };
}

export default function PassportScreen() {
  const { data, error } = useLoad(() => api.get<Passport>("/kid/passport"));
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return error ? <Screen><ErrorText error={error} /></Screen> : <Loading />;
  const have = new Set(data.medals.map((m) => m.medal_id));
  const li = CREATOR_LEVELS.findIndex((l) => l.id === data.level);
  return (
    <Screen>
      <Card tint="violet">
        <Row>
          <Text style={{ fontSize: 48 }}>{data.avatar}</Text>
          <View>
            <Muted style={{ letterSpacing: 1 }}>CREATOR PASSPORT</Muted>
            <H1>{data.name}</H1>
          </View>
        </Row>
        <Row>
          {[["🏅", data.medals.length, "Medals"], ["📦", data.stats.projects, "Projects"], ["🎮", data.stats.games, "Games"], ["📱", data.stats.apps, "Apps"], ["🎨", data.stats.creations, "Creations"], ["🐛", data.stats.bugsFixed, "Bugs fixed"]].map(([e, n, l]) => (
            <View key={String(l)} style={{ flexBasis: "30%", flexGrow: 1, backgroundColor: "#fff", borderRadius: 14, padding: 8, alignItems: "center" }}>
              <Text style={{ fontSize: 18 }}>{e}</Text>
              <Text style={{ fontSize: 20, fontWeight: "900" }}>{n}</Text>
              <Muted style={{ fontSize: 12 }}>{l}</Muted>
            </View>
          ))}
        </Row>
      </Card>
      <H2>Creator level</H2>
      <Row>
        {CREATOR_LEVELS.map((l, i) => (
          <Chip key={l.id} tone={i < li ? "violet" : "gray"} selected={i === li} label={`${l.emoji} ${l.label}`} />
        ))}
      </Row>
      <Muted>{CREATOR_LEVELS[li]?.about}. Levels grow with what you can do — not your age.</Muted>
      <H2>Medals</H2>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {MEDALS.map((m) => {
          const got = have.has(m.id);
          const secret = m.hidden && !got;
          return (
            <View key={m.id} style={{ flexBasis: "30%", flexGrow: 1, backgroundColor: "#fff", borderRadius: 16, padding: 10, alignItems: "center", borderWidth: 1, borderColor: C.line, opacity: got ? 1 : 0.45 }}>
              <Text style={{ fontSize: 30 }}>{secret ? "🎁" : m.emoji}</Text>
              <Text style={{ fontWeight: "900", textAlign: "center", fontSize: 13 }}>{secret ? "???" : m.title}</Text>
              <Muted style={{ fontSize: 11, textAlign: "center" }}>{secret ? "A surprise to discover" : m.about}</Muted>
            </View>
          );
        })}
      </View>
      <H2>Skills discovered</H2>
      {data.skills.length === 0 ? <Muted>Build something to discover your first engineering concept!</Muted> : null}
      <Row>{data.skills.map((x) => <Chip key={x.concept} tone="sky" selected={open === x.concept} label={`${CONCEPTS[x.concept]?.emoji ?? "💡"} ${x.concept}`} onPress={() => setOpen(open === x.concept ? null : x.concept)} />)}</Row>
      {open && CONCEPTS[open] ? <Card tint="sky"><Text style={{ fontWeight: "700" }}>{CONCEPTS[open].emoji} {open}: {CONCEPTS[open].older}</Text></Card> : null}
    </Screen>
  );
}
