// Native runtime for apps kids build: screens of building blocks, rendered with real native views.
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { AppBlock, AppItem, AppSpec } from "../../../shared/app";
import { C, Muted, s } from "./ui";

type Ask = (question: string) => Promise<string>;

function fill(text: string, item: AppItem | null, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => {
    if (item && k in item) {
      const v = item[k as keyof AppItem];
      return Array.isArray(v) ? v.join(", ") : String(v);
    }
    return vars[k] ?? "";
  });
}

function Guide({ block, ask, color }: { block: AppBlock; ask?: Ask; color: string }) {
  const [q, setQ] = useState("");
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);
  if (!ask || block.text === "__disabled__") {
    return (
      <View style={{ backgroundColor: C.bg, borderRadius: 16, padding: 14 }}>
        <Text style={{ fontWeight: "900" }}>{block.emoji || "🤖"} AI Guide</Text>
        <Muted>The AI guide works when you open this app in SparkForge.</Muted>
      </View>
    );
  }
  const send = async () => {
    if (!q.trim() || busy) return;
    const question = q;
    setQ("");
    setBusy(true);
    try {
      const a = await ask(question);
      setLog((l) => [...l, { q: question, a }]);
    } catch (e) {
      setLog((l) => [...l, { q: question, a: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ backgroundColor: C.bg, borderRadius: 16, padding: 14, gap: 8 }}>
      <Text style={{ fontWeight: "900" }}>{block.emoji || "🤖"} I'm {block.text || "your guide"}!</Text>
      {log.map((l, i) => (
        <View key={i}>
          <Text style={{ fontWeight: "800" }}>You: {l.q}</Text>
          <Text>{l.a}</Text>
        </View>
      ))}
      {busy && <Muted>Thinking…</Muted>}
      <View style={{ flexDirection: "row", gap: 6 }}>
        <TextInput style={[s.input, { flex: 1 }]} value={q} onChangeText={setQ} onSubmitEditing={send} placeholder="Ask me something…" placeholderTextColor={C.ink3} />
        <Pressable onPress={send} style={{ backgroundColor: color, borderRadius: 12, paddingHorizontal: 14, justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "900" }}>Ask</Text>
        </Pressable>
      </View>
      <Muted style={{ fontSize: 12 }}>🤖 AI answers can be wrong — check important facts.</Muted>
    </View>
  );
}

export function AppView({ spec, ask }: { spec: AppSpec; ask?: Ask }) {
  const [screenId, setScreen] = useState(spec.startScreen);
  const [item, setItem] = useState<AppItem | null>(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [search, setSearch] = useState<Record<string, string>>({});
  const screen = spec.screens.find((x) => x.id === screenId);
  const color = spec.theme.color;
  const go = (id: string) => spec.screens.some((x) => x.id === id) && setScreen(id);

  const block = (b: AppBlock, i: number) => {
    const key = `${screenId}-${i}`;
    switch (b.type) {
      case "heading":
        return <Text key={key} style={{ fontSize: 22, fontWeight: "900", color: C.ink }}>{fill(b.text, item, vars)}</Text>;
      case "text":
        return <Text key={key} style={{ fontSize: 15, color: C.ink }}>{fill(b.text, item, vars)}</Text>;
      case "image":
        return <Text key={key} style={{ fontSize: 72, textAlign: "center" }}>{fill(b.emoji || "🖼️", item, vars)}</Text>;
      case "card": {
        const [title, ...rest] = fill(b.text, item, vars).split("|");
        return (
          <View key={key} style={{ backgroundColor: C.bg, borderRadius: 16, padding: 14 }}>
            <Text style={{ fontSize: 26 }}>{b.emoji}</Text>
            <Text style={{ fontWeight: "900" }}>{title}</Text>
            {rest.length > 0 && <Text>{rest.join("|")}</Text>}
          </View>
        );
      }
      case "button":
        return (
          <Pressable key={key} accessibilityRole="button" onPress={() => go(b.goTo)} style={{ backgroundColor: color, borderRadius: 14, padding: 14, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>{b.emoji} {b.text || "Go"}</Text>
          </Pressable>
        );
      case "search":
        return (
          <TextInput
            key={key}
            style={s.input}
            placeholder="🔍 Search…"
            placeholderTextColor={C.ink3}
            value={search[screenId] ?? ""}
            onChangeText={(v) => setSearch({ ...search, [screenId]: v })}
          />
        );
      case "list": {
        const col = spec.collections.find((c) => c.name === b.collection);
        const q = (search[screenId] ?? "").toLowerCase();
        const items = (col?.items ?? []).filter((it) => !q || `${it.title} ${it.subtitle}`.toLowerCase().includes(q));
        if (!col?.items.length) return <Muted key={key}>This list is empty.</Muted>;
        return (
          <View key={key} style={{ gap: 8 }}>
            {items.map((it, j) => (
              <Pressable
                key={j}
                accessibilityRole="button"
                onPress={() => {
                  setItem(it);
                  if (b.goTo) go(b.goTo);
                }}
                style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 12, borderRadius: 14, backgroundColor: C.bg }}
              >
                <Text style={{ fontSize: 28 }}>{it.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900" }}>{it.title}</Text>
                  <Muted style={{ fontSize: 13 }}>{it.subtitle}</Muted>
                </View>
              </Pressable>
            ))}
            {!items.length && <Muted>Nothing matches “{q}”.</Muted>}
          </View>
        );
      }
      case "input":
        return (
          <View key={key} style={{ gap: 6 }}>
            <Text style={{ fontWeight: "800" }}>{b.text || "Type here"}</Text>
            <TextInput style={s.input} value={vars[b.variable] ?? ""} onChangeText={(v) => setVars({ ...vars, [b.variable]: v })} />
          </View>
        );
      case "facts":
        return item?.facts.length ? (
          <View key={key} style={{ gap: 6 }}>
            {item.facts.map((f, j) => (
              <Text key={j} style={{ fontWeight: "600" }}>💡 {f}</Text>
            ))}
          </View>
        ) : null;
      case "aiGuide":
        return <Guide key={key} block={b} ask={ask} color={color} />;
    }
  };

  const nav = spec.screens.filter((x) => x.inNav);
  return (
    <View style={{ borderRadius: 28, borderWidth: 8, borderColor: C.ink, overflow: "hidden", backgroundColor: "#fff", minHeight: 520 }}>
      <View style={{ backgroundColor: color, padding: 14, flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Text style={{ fontSize: 20 }}>{spec.theme.emoji}</Text>
        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>{spec.title}</Text>
      </View>
      <View style={{ padding: 16, gap: 12, flex: 1 }}>{screen ? screen.blocks.map(block) : <Muted>🐛 This screen doesn't exist: “{screenId}”.</Muted>}</View>
      {nav.length > 1 && (
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line }}>
          {nav.map((x) => (
            <Pressable key={x.id} accessibilityRole="tab" onPress={() => go(x.id)} style={{ flex: 1, alignItems: "center", paddingVertical: 8 }}>
              <Text style={{ fontSize: 18 }}>{x.emoji}</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: x.id === screenId ? C.ink : C.ink3 }}>{x.title}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
