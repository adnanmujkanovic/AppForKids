import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Text, View } from "react-native";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { useLoad } from "../../lib/useLoad";
import { Button, C, Card, Chip, ErrorText, H2, H3, Loading, Muted, Note, P, Row, Screen, TYPE_INFO, timeAgo } from "../../components/ui";
import { CREATOR_LEVELS, type ChildProfile } from "../../../../shared/types";

interface DashChild extends ChildProfile {
  level: string;
  projectCount: number;
  recentProjects: { id: string; type: string; title: string; emoji: string; version: number; updated_at: string }[];
  topics: string[];
  newSkills: string[];
  medals: { id: string; emoji: string; title: string }[];
  safety: "ok" | "review" | "attention";
  aiToday: number;
  activity14d: number;
  friends: { id: string; name: string; avatar: string }[];
}
interface Dash {
  children: DashChild[];
  alerts: { id: string; childName: string; severity: string; summary: string; excerpt: string; reviewed: boolean; createdAt: string }[];
  shares: { token: string; childName: string; title: string; emoji: string; audience: string; status: string; views: number; plays: number }[];
  ai: { live: boolean };
}

export default function ParentDashboard() {
  const { signIn, signOut, me } = useSession();
  const { data, error, reload } = useLoad(() => api.get<Dash>("/parent/dashboard"));
  // Refresh when coming back from settings or adding a child.
  useFocusEffect(useCallback(() => void reload(), [reload]));
  if (!data) return error ? <Screen><ErrorText error={error} /></Screen> : <Loading />;
  const enter = async (id: string) => {
    const r = await api.post<{ token: string }>(`/parent/children/${id}/enter`);
    await signIn(r.token);
    router.replace("/kid");
  };
  const pending = data.shares.filter((x) => x.status === "pending");
  const open = data.alerts.filter((a) => !a.reviewed);
  return (
    <Screen>
      <Row style={{ justifyContent: "space-between" }}>
        <Muted>Signed in as {me?.parent?.name}</Muted>
        <Button size="sm" variant="ghost" title="Sign out" onPress={async () => { await signOut(); router.replace("/welcome"); }} />
      </Row>
      {!data.ai.live ? <Note>🧪 No AI model is connected to the server, so SparkForge uses its built-in practice helper.</Note> : null}
      {data.children.length === 0 ? (
        <Card tint="violet">
          <H2>Welcome! 👋</H2>
          <P>Start by adding your child. Then hand them the device with “Start creating”.</P>
        </Card>
      ) : null}
      {data.children.map((c) => {
        const lvl = CREATOR_LEVELS.find((l) => l.id === c.level);
        return (
          <Card key={c.id}>
            <Row>
              <Text style={{ fontSize: 40 }}>{c.avatar}</Text>
              <View style={{ flex: 1 }}>
                <H2>{c.name}</H2>
                <Muted>Age {c.age} · {lvl?.emoji} {lvl?.label}</Muted>
              </View>
            </Row>
            <Chip tone={c.safety === "ok" ? "mint" : c.safety === "review" ? "sun" : "coral"} label={c.safety === "ok" ? "🟢 No safety issues" : c.safety === "review" ? "🟡 Items to review" : "🔴 Needs attention"} />
            <Row>
              {[
                [c.projectCount, "projects"],
                [c.medals.length, "medals"],
                [c.activity14d, "activities (14d)"],
                [`${c.aiToday}/${c.permissions.dailyAiLimit}`, "AI today"],
              ].map(([n, l]) => (
                <View key={String(l)} style={{ flexGrow: 1, flexBasis: "40%", backgroundColor: C.bg, borderRadius: 14, padding: 10, alignItems: "center" }}>
                  <Text style={{ fontSize: 20, fontWeight: "900" }}>{n}</Text>
                  <Muted style={{ fontSize: 12 }}>{l}</Muted>
                </View>
              ))}
            </Row>
            {c.recentProjects.length ? (
              <View style={{ gap: 4 }}>
                <H3>Recent creations</H3>
                {c.recentProjects.slice(0, 4).map((p) => (
                  <Text key={p.id} style={{ fontWeight: "700", color: C.ink }}>
                    {p.emoji} {p.title} <Text style={{ color: C.ink3 }}>· {TYPE_INFO[p.type]?.label} v{p.version} · {timeAgo(p.updated_at)}</Text>
                  </Text>
                ))}
              </View>
            ) : null}
            {c.topics.length ? <Row><Muted>Curious about:</Muted>{c.topics.map((t) => <Chip key={t} tone="gray" label={t} />)}</Row> : null}
            {c.newSkills.length ? <Row><Muted>Skills:</Muted>{c.newSkills.map((t) => <Chip key={t} tone="sky" label={t} />)}</Row> : null}
            {c.medals.length ? <Row>{c.medals.slice(0, 6).map((m) => <Chip key={m.id} tone="sun" label={`${m.emoji} ${m.title}`} />)}</Row> : null}
            <Button size="lg" title={`▶ Start creating as ${c.name}`} onPress={() => enter(c.id)} />
            <Button variant="ghost" title="⚙️ Settings, permissions & friends" onPress={() => router.push({ pathname: "/parent/child/[id]", params: { id: c.id } })} />
          </Card>
        );
      })}
      <Button variant="sun" title="➕ Add a child" onPress={() => router.push("/parent/add-child")} />

      {pending.length > 0 && (
        <Card>
          <H3>✅ Shares waiting for approval</H3>
          {pending.map((x) => (
            <View key={x.token} style={{ gap: 6 }}>
              <P>{x.childName} wants to share {x.emoji} {x.title} with {x.audience}</P>
              <Row>
                <Button size="sm" variant="ghost" title="Preview" onPress={() => router.push({ pathname: "/s/[token]", params: { token: x.token } })} />
                <Button size="sm" variant="mint" title="Approve" onPress={async () => { await api.post(`/parent/shares/${x.token}/approve`); reload(); }} />
                <Button size="sm" variant="danger" title="Decline" onPress={async () => { await api.post(`/parent/shares/${x.token}/revoke`); reload(); }} />
              </Row>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <H3>🛡️ Safety {open.length ? `· ${open.length} to review` : "· all clear"}</H3>
        <Muted>Short alerts when something matters — not every conversation.</Muted>
        {data.alerts.length === 0 ? <P>No safety events. 🎉</P> : null}
        {data.alerts.slice(0, 10).map((a) => (
          <View key={a.id} style={{ backgroundColor: C.bg, borderRadius: 14, padding: 12, gap: 4, opacity: a.reviewed ? 0.55 : 1 }}>
            <Row>
              <Chip tone={a.severity === "high" ? "coral" : a.severity === "medium" ? "sun" : "gray"} label={a.severity.toUpperCase()} />
              <Text style={{ fontWeight: "900" }}>{a.childName}</Text>
              <Muted>{timeAgo(a.createdAt)}</Muted>
            </Row>
            <P>{a.summary}</P>
            {a.excerpt ? <Muted>“{a.excerpt}”</Muted> : null}
            {!a.reviewed ? <Button size="sm" variant="ghost" title="Mark reviewed" onPress={async () => { await api.post(`/parent/alerts/${a.id}/review`); reload(); }} /> : null}
          </View>
        ))}
      </Card>

      <Card>
        <H3>🔗 Shared links</H3>
        {data.shares.filter((x) => x.status === "active").map((x) => (
          <Row key={x.token} style={{ justifyContent: "space-between" }}>
            <Text style={{ flex: 1, fontWeight: "700" }}>{x.emoji} {x.title} <Text style={{ color: C.ink3 }}>· {x.childName} · {x.audience} · 👀 {x.views}</Text></Text>
            <Button size="sm" variant="danger" title="Turn off" onPress={async () => { await api.post(`/parent/shares/${x.token}/revoke`); reload(); }} />
          </Row>
        ))}
        {!data.shares.some((x) => x.status === "active") ? <Muted>No active links.</Muted> : null}
      </Card>
      <Button variant="ghost" title="🔌 Contacts, email outbox & GitHub" onPress={() => router.push("/parent/connectors")} />
    </Screen>
  );
}
