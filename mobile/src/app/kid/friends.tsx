import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { C, Card, Chip, ErrorText, H3, Loading, Muted, Row, Screen, TYPE_INFO, s, timeAgo } from "../../components/ui";

interface FriendsData {
  enabled: boolean;
  friends: { id: string; name: string; avatar: string }[];
  inbox: { id: string; token: string; note: string; seen: boolean; createdAt: string; from: { name: string; avatar: string }; title: string; emoji: string; type: string }[];
  team: { id: string; title: string; emoji: string; type: string; owner: string }[];
}

export default function Friends() {
  const { data, error, reload } = useLoad(() => api.get<FriendsData>("/kid/friends"));
  useFocusEffect(useCallback(() => void reload(), [reload]));
  useEffect(() => {
    if (data?.inbox.some((i) => !i.seen)) api.post("/kid/inbox/seen").catch(() => {});
  }, [data]);
  if (!data) return error ? <Screen><ErrorText error={error} /></Screen> : <Loading />;
  if (!data.enabled) return <Screen><Card><Muted>🔒 Friends are turned off in your family settings. Ask a parent!</Muted></Card></Screen>;
  return (
    <Screen>
      <Card>
        <H3>My friends</H3>
        {data.friends.length ? <Row>{data.friends.map((f) => <Chip key={f.id} label={`${f.avatar} ${f.name}`} />)}</Row> : <Muted>No friends yet. Friends are added by grown-ups with a friend code — that keeps everyone safe!</Muted>}
      </Card>
      <Card>
        <H3>📬 Sent to me</H3>
        {data.inbox.length === 0 ? <Muted>Nothing yet.</Muted> : null}
        {data.inbox.map((i) => (
          <Pressable key={i.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/s/[token]", params: { token: i.token } })} style={[s.toggle]}>
            <Text style={{ fontSize: 30 }}>{i.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900" }}>{i.title} {!i.seen ? "🆕" : ""}</Text>
              <Muted>{i.from.avatar} {i.from.name}: “{i.note}” · {timeAgo(i.createdAt)}</Muted>
            </View>
            <Text style={{ color: C.violet, fontWeight: "900" }}>{i.type === "game" || i.type === "code" ? "▶ Play" : "Open"}</Text>
          </Pressable>
        ))}
      </Card>
      {data.team.length ? (
        <Card>
          <H3>👥 Building together</H3>
          {data.team.map((t) => (
            <Pressable key={t.id} onPress={() => router.push({ pathname: "/kid/project/[id]", params: { id: t.id, tab: "team" } })}>
              <Text style={{ fontWeight: "800" }}>{t.emoji} {t.title} <Text style={{ color: C.ink3 }}>· with {t.owner} · {TYPE_INFO[t.type]?.label}</Text></Text>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
