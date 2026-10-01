import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { api } from "../../../lib/api";
import { appRoute, loadHome } from "../../../lib/kid";
import { useLoad } from "../../../lib/useLoad";
import { ProjectList } from "../../../components/ProjectList";
import { Button, C, Card, Chip, ErrorText, H2, H3, Loading, Muted, Row, Screen, Tile, timeAgo } from "../../../components/ui";
import { CREATOR_LEVELS, HELP_LEVELS } from "../../../../../shared/types";

export default function KidHome() {
  const { data, error, reload } = useLoad(loadHome);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const [q, setQ] = useState("");
  if (!data) return error ? <Screen><ErrorText error={error} /></Screen> : <Loading />;
  const { child, journey } = data;
  const p = child.permissions;
  const level = CREATOR_LEVELS.find((l) => l.id === data.level)!;
  const ask = () => q.trim() && router.push({ pathname: "/kid/explore", params: { q } });
  const steps = [
    { done: journey.asked, label: "🔭 Ask a question", to: "/kid/explore" },
    { done: journey.image, label: "🎨 Make a picture", to: "/kid/create" },
    { done: journey.game, label: "🎮 Build a game", to: "/kid/build" },
    { done: journey.played, label: "▶ Play it!", to: "/kid/mine" },
  ];
  const firstOpen = steps.findIndex((x) => !x.done);
  const tiles: { emoji: string; title: string; sub: string; to: string; ok: boolean }[] = [
    { emoji: "🔭", title: "Explore", sub: "Ask anything", to: "/kid/explore", ok: p.aiQuestions },
    { emoji: "🎨", title: "Create", sub: "Pictures & stories", to: "/kid/create", ok: p.imageGeneration || p.storyCreation },
    { emoji: "🎮", title: "Build a game", sub: "Make it playable", to: "/kid/build", ok: p.gameCreation },
    { emoji: "🛠️", title: "Make an app", sub: "Screens, data, buttons", to: "/kid/apps", ok: p.appCreation },
    { emoji: "⌨️", title: "Code Mode", sub: "Real JavaScript", to: "/kid/code", ok: p.codeMode },
    { emoji: "📚", title: "Learn", sub: "Homework helper", to: "/kid/learn", ok: p.aiQuestions },
    { emoji: "🗓️", title: "Planner", sub: "Big things, small steps", to: "/kid/plans", ok: p.aiQuestions },
    { emoji: "🚀", title: "Missions", sub: "Guided challenges", to: "/kid/missions", ok: true },
    { emoji: "🕵️", title: "AI Detective", sub: "Catch AI mistakes", to: "/kid/detective", ok: p.aiQuestions },
    { emoji: "🤝", title: "Friends", sub: "Sent to me · together", to: "/kid/friends", ok: p.friends },
    { emoji: "🌍", title: "Creator Feed", sub: "What others made", to: "/kid/feed", ok: p.seeFeed },
    { emoji: "🏆", title: "Achievements", sub: "Creator Passport", to: "/kid/passport", ok: true },
  ];
  const unread = data.notifications.filter((n) => !n.read);
  return (
    <Screen>
      <View style={{ backgroundColor: C.violet, borderRadius: 26, padding: 20, gap: 12 }}>
        <Chip tone="violet" label={`${level.emoji} ${level.label}`} />
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900" }}>Hi {child.name} {child.avatar} What are you curious about?</Text>
        <View style={{ flexDirection: "row", backgroundColor: "#fff", borderRadius: 16, padding: 6, gap: 6 }}>
          <TextInput value={q} onChangeText={setQ} onSubmitEditing={ask} placeholder="Why is Mars red?" placeholderTextColor={C.ink3} style={{ flex: 1, minWidth: 0, fontSize: 16, paddingHorizontal: 10, fontWeight: "600", color: C.ink }} accessibilityLabel="Ask a question" returnKeyType="search" />
          <Button title="Ask ✨" onPress={ask} />
        </View>
        <Row>
          {child.interests.map((i) => (
            <Pressable key={i} onPress={() => router.push({ pathname: "/kid/explore", params: { q: `Tell me something amazing about ${i}` } })} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>{i}</Text>
            </Pressable>
          ))}
        </Row>
      </View>

      {unread.length > 0 && (
        <Card tint="sun">
          <H3>🔔 What's new</H3>
          {unread.slice(0, 5).map((n) => (
            <Pressable key={n.id} onPress={() => { const r = appRoute(n.link); if (r) router.push(r as Href); }}>
              <Text style={{ fontWeight: "700", color: C.ink }}>{n.emoji} {n.text} <Text style={{ color: C.ink3 }}>· {timeAgo(n.createdAt)}</Text></Text>
            </Pressable>
          ))}
          <Button size="sm" variant="ghost" title="Mark as seen" onPress={async () => { await api.post("/kid/notifications/read"); reload(); }} />
        </Card>
      )}

      {firstOpen >= 0 && (
        <Card>
          <H3>🌟 Your first creation — about 15 minutes</H3>
          <Row>
            {steps.map((x, i) => (
              <Chip key={i} tone={x.done ? "mint" : i === firstOpen ? "violet" : "gray"} label={`${x.done ? "✅" : `${i + 1}.`} ${x.label}`} onPress={() => router.push(x.to as Href)} />
            ))}
          </Row>
        </Card>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {tiles.map((t) => (
          <Tile key={t.to} emoji={t.emoji} title={t.title} sub={t.sub} locked={!t.ok} onPress={() => router.push(t.to as Href)} />
        ))}
      </View>

      <Card>
        <H3>🤖 How much should AI help?</H3>
        <Row>
          {HELP_LEVELS.map((h) => (
            <Chip key={h.id} tone="gray" selected={child.helpLevel === h.id} label={`${h.emoji} ${h.label}`} onPress={async () => { await api.patch("/kid/settings", { helpLevel: h.id }); reload(); }} />
          ))}
        </Row>
        <Muted>{HELP_LEVELS.find((h) => h.id === child.helpLevel)?.about}. You can change this any time.</Muted>
      </Card>

      {data.projects.length > 0 && (
        <>
          <H2>Recent creations</H2>
          <ProjectList projects={data.projects.slice(0, 4)} />
        </>
      )}
    </Screen>
  );
}
