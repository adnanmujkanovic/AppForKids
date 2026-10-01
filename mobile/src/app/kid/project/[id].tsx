// The project studio: PLAY · BUILD · TEST · EXPLAIN · CODE · TEAM · SHARE · HISTORY.
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api, errorText } from "../../../lib/api";
import { useLoad } from "../../../lib/useLoad";
import { useRewards, type Rewards } from "../../../components/Rewards";
import { Button, C, Chip, ErrorText, Loading, Muted, Note, Screen, TYPE_INFO } from "../../../components/ui";
import { BuildTab, CodeTab, ExplainTab, HistoryTab, PlayTab, ShareTab, TeamTab, TestTab, focusSection, type Detail } from "../../../components/studio/Tabs";
import type { GameBug } from "../../../../../shared/game";
import type { Project } from "../../../../../shared/types";

type Tab = "play" | "build" | "test" | "explain" | "code" | "team" | "share" | "history";

export default function ProjectStudio() {
  const params = useLocalSearchParams<{ id: string; tab?: string; note?: string }>();
  const showRewards = useRewards();
  const { data, error, reload, setData } = useLoad(() => api.get<Detail>(`/kid/projects/${params.id}`), [params.id]);
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || "play");
  const [focus, setFocus] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(params.note || null);
  if (!data) return error ? <Screen><ErrorText error={error} /></Screen> : <Loading />;
  const p = data.project;
  const owner = data.role === "owner";
  const interactive = p.type === "game" || p.type === "app";
  const all: [Tab, string][] =
    p.type === "code"
      ? [["play", "▶ RUN"], ["build", "⌨️ CODE"], ["explain", "💡 EXPLAIN"], ["team", "👥 TEAM"], ["share", "👋 SHARE"], ["history", "🕰️ HISTORY"]]
      : interactive
        ? [["play", "▶ PLAY"], ["build", "🧩 BUILD"], ["test", "✅ TEST"], ["explain", "💡 EXPLAIN"], ["code", "</> CODE"], ["team", "👥 TEAM"], ["share", "👋 SHARE"], ["history", "🕰️ HISTORY"]]
        : [["play", "👀 VIEW"], ["build", "✏️ EDIT"], ["explain", "💡 EXPLAIN"], ["share", "👋 SHARE"], ["history", "🕰️ HISTORY"]];
  const tabs = all.filter(([t]) => (t !== "share" || owner) && (t !== "team" || !owner || data.permissions.collaboration));
  const refresh = async (rewards?: Rewards | null) => {
    showRewards(rewards);
    await reload();
  };
  const saveSpec = async (spec: unknown) => {
    setSaving(true);
    try {
      const r = await api.put<{ project: Project; solved?: GameBug[]; rewards: Rewards }>(`/kid/projects/${p.id}/spec`, { spec });
      setFocus("");
      if (r.solved?.length) setNote(`🎉 You fixed it yourself: ${r.solved.map((x) => x.title.replace(/^🐛\s*/, "")).join(", ")}!`);
      await refresh(r.rewards);
    } catch (e) {
      setNote(errorText(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ title: `${p.emoji} ${p.title}` }} />
      <View style={{ paddingHorizontal: 16, paddingTop: 4, gap: 8 }}>
        <Muted>
          {TYPE_INFO[p.type].emoji} {TYPE_INFO[p.type].label} · version {p.version}
          {p.remixedFrom ? " · 🔄 remix" : ""}
          {data.owner ? ` · 🤝 building with ${data.owner}` : ""}
        </Muted>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 6 }}>
          {tabs.map(([t, label]) => (
            <Chip key={t} tone="gray" selected={tab === t} label={label} onPress={() => setTab(t)} />
          ))}
        </ScrollView>
      </View>
      <Screen>
        {note ? <Note>{note}</Note> : null}
        {(p.type === "image" || p.type === "story") && data.permissions.gameCreation && tab === "play" ? (
          <Button variant="sun" title="🎮 Turn it into a game" onPress={() => router.push({ pathname: "/kid/build", params: { idea: `A game about ${p.title}`, notes: p.idea } })} />
        ) : null}
        {tab === "play" && <PlayTab p={p} onImprove={() => setTab("build")} />}
        {tab === "build" && (
          <BuildTab d={data} focus={focus} saving={saving} onSave={saveSpec} onDone={refresh} onFocus={setFocus} onReplace={(proj) => setData({ ...data, project: proj })} />
        )}
        {tab === "test" && <TestTab p={p} onDone={refresh} onTry={(where) => { setFocus(focusSection(where)); setTab("build"); }} />}
        {tab === "explain" && <ExplainTab d={data} onDone={refresh} />}
        {tab === "code" && <CodeTab p={p} canEject={data.permissions.codeMode} />}
        {tab === "team" && <TeamTab d={data} onDone={refresh} />}
        {tab === "share" && <ShareTab d={data} onDone={refresh} />}
        {tab === "history" && <HistoryTab d={data} onDone={refresh} />}
        <Text style={{ height: 1 }} />
      </Screen>
    </View>
  );
}
