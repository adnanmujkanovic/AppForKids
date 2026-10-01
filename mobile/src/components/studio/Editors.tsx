// BUILD mode on phones: hands-on editors for every project type, labeled with the concepts they teach.
import { useEffect, useState, type ReactNode } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { Button, C, Card, Chip, Field, H3, Muted, Row, s } from "../ui";
import { SceneView } from "../SceneView";
import { GAME_KIND_INFO, GAME_KINDS, type GameSpec } from "../../../../shared/game";
import { BLOCK_INFO, BLOCK_TYPES, blankBlock, type AppSpec } from "../../../../shared/app";
import type { CodeSpec, SceneSpec, StorySpec } from "../../../../shared/creations";

function SaveBar({ dirty, saving, onUndo, onSave }: { dirty: boolean; saving?: boolean; onUndo: () => void; onSave: () => void }) {
  return (
    <Card style={{ paddingVertical: 10 }}>
      <Muted>{dirty ? "✏️ You have unsaved changes" : "Change anything, then save a new version."}</Muted>
      <Row>
        <Button size="sm" variant="ghost" title="Undo" disabled={!dirty} onPress={onUndo} />
        <Button size="sm" variant="mint" title={saving ? "Saving…" : "💾 Save version"} disabled={!dirty || saving} onPress={onSave} />
      </Row>
    </Card>
  );
}

function Section({ title, concepts, focus, children }: { title: string; concepts: string[]; focus?: boolean; children: ReactNode }) {
  return (
    <Card style={focus ? { borderColor: C.coral, borderWidth: 2 } : undefined}>
      <Row>
        <H3>{title}</H3>
        {concepts.map((c) => <Chip key={c} tone="sky" label={c} />)}
        {focus ? <Chip tone="coral" label="🐛 Look here" /> : null}
      </Row>
      {children}
    </Card>
  );
}

/** A small +/- number control (sliders are awkward for kids on small screens). */
function Stepper({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <Row wrap={false} style={{ justifyContent: "space-between" }}>
      <Text style={{ fontWeight: "800", color: C.ink2, flex: 1 }}>{label}</Text>
      <Button size="sm" variant="ghost" title="−" onPress={() => onChange(Math.max(min, value - step))} disabled={value <= min} />
      <Text style={{ fontWeight: "900", minWidth: 44, textAlign: "center", fontSize: 16 }}>{value}</Text>
      <Button size="sm" variant="ghost" title="+" onPress={() => onChange(Math.min(max, value + step))} disabled={value >= max} />
    </Row>
  );
}

const num = (v: string, fb = 0) => (v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : fb);
const inp = [s.input, { paddingVertical: 8 }];

export function GameEditor({ spec, onSave, focus = "", saving }: { spec: GameSpec; onSave: (g: GameSpec) => void; focus?: string; saving?: boolean }) {
  const [d, setD] = useState(spec);
  useEffect(() => setD(spec), [spec]);
  const set = (patch: Partial<GameSpec>) => setD({ ...d, ...patch });
  const dirty = JSON.stringify(d) !== JSON.stringify(spec);
  return (
    <View style={{ gap: 12 }}>
      <SaveBar dirty={dirty} saving={saving} onUndo={() => setD(spec)} onSave={() => onSave(d)} />
      <Section title="🎯 The game" concepts={["Game Design"]} focus={focus === "basics"}>
        <Field label="Title" value={d.title} onChangeText={(title) => set({ title })} maxLength={60} />
        <Row>{GAME_KINDS.map((k) => <Chip key={k} tone="gray" selected={d.kind === k} label={`${GAME_KIND_INFO[k].emoji} ${GAME_KIND_INFO[k].label}`} onPress={() => set({ kind: k })} />)}</Row>
        <Field label="Goal" value={d.goal} onChangeText={(goal) => set({ goal })} maxLength={200} />
      </Section>
      <Section title="🕹️ Player" concepts={["Variables", "Movement"]} focus={focus === "player"}>
        <Row wrap={false}>
          <TextInput style={[inp, { width: 60, textAlign: "center" }]} value={d.player.emoji} onChangeText={(emoji) => set({ player: { ...d.player, emoji } })} accessibilityLabel="Player emoji" />
          <TextInput style={[inp, { flex: 1 }]} value={d.player.name} onChangeText={(name) => set({ player: { ...d.player, name } })} accessibilityLabel="Player name" />
        </Row>
        <Stepper label="speed" value={d.player.speed} min={0} max={10} onChange={(speed) => set({ player: { ...d.player, speed } })} />
        <Muted>Each frame: position = position + speed. What happens at 0?</Muted>
      </Section>
      <Section title="⭐ Things to collect" concepts={["Data", "Variables"]} focus={focus === "collectibles"}>
        {d.collectibles.map((c, i) => {
          const upd = (patch: Partial<typeof c>) => set({ collectibles: d.collectibles.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <View key={i} style={{ gap: 6, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Row wrap={false}>
                <TextInput style={[inp, { width: 56, textAlign: "center" }]} value={c.emoji} onChangeText={(emoji) => upd({ emoji })} />
                <TextInput style={[inp, { flex: 1 }]} value={c.name} onChangeText={(name) => upd({ name })} />
                <TextInput style={[inp, { width: 60, textAlign: "center" }]} value={String(c.points)} keyboardType="numbers-and-punctuation" onChangeText={(v) => upd({ points: num(v) })} accessibilityLabel="Points" />
                <Button size="sm" variant="danger" title="✕" onPress={() => set({ collectibles: d.collectibles.filter((_, j) => j !== i) })} />
              </Row>
              <TextInput style={inp} value={c.fact} placeholder="A true fact players learn when they collect it" placeholderTextColor={C.ink3} onChangeText={(fact) => upd({ fact })} />
            </View>
          );
        })}
        {d.collectibles.length < 8 ? <Button size="sm" variant="ghost" title="+ Add collectible" onPress={() => set({ collectibles: [...d.collectibles, { emoji: "⭐", name: "Star", points: 1, fact: "" }] })} /> : null}
        <Muted>On touch: score = score + points</Muted>
      </Section>
      <Section title="⚠️ Dangers" concepts={["Collisions", "Events"]} focus={focus === "hazards"}>
        {d.hazards.map((h, i) => {
          const upd = (patch: Partial<typeof h>) => set({ hazards: d.hazards.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <Row key={i} wrap={false}>
              <TextInput style={[inp, { width: 56, textAlign: "center" }]} value={h.emoji} onChangeText={(emoji) => upd({ emoji })} />
              <TextInput style={[inp, { flex: 1 }]} value={h.name} onChangeText={(name) => upd({ name })} />
              <Chip tone="gray" selected={h.moves} label="moves" onPress={() => upd({ moves: !h.moves })} />
              <Button size="sm" variant="danger" title="✕" onPress={() => set({ hazards: d.hazards.filter((_, j) => j !== i) })} />
            </Row>
          );
        })}
        {d.hazards.length < 6 ? <Button size="sm" variant="ghost" title="+ Add danger" onPress={() => set({ hazards: [...d.hazards, { emoji: "🪨", name: "Rock", moves: false }] })} /> : null}
        <Muted>On collision: lives = lives - 1</Muted>
      </Section>
      <Section title="📏 Rules" concepts={["Conditions", "Timers"]} focus={focus === "rules"}>
        <Stepper label="lives" value={d.rules.lives} min={0} max={10} onChange={(lives) => set({ rules: { ...d.rules, lives } })} />
        <Stepper label="timer (seconds, 0 = off)" value={d.rules.timeLimit} min={0} max={180} step={15} onChange={(timeLimit) => set({ rules: { ...d.rules, timeLimit } })} />
        <Muted>IF lives == 0 THEN game over</Muted>
      </Section>
      <Section title="🪜 Levels" concepts={["Loops", "Conditions"]} focus={focus === "levels"}>
        {d.levels.map((l, i) => {
          const upd = (patch: Partial<typeof l>) => set({ levels: d.levels.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <View key={i} style={{ gap: 4, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Row wrap={false}>
                <TextInput style={[inp, { flex: 1 }]} value={l.name} onChangeText={(name) => upd({ name })} />
                <Button size="sm" variant="danger" title="✕" onPress={() => set({ levels: d.levels.filter((_, j) => j !== i) })} />
              </Row>
              <Row wrap={false}>
                <Text style={{ fontWeight: "800", color: C.ink2, flex: 1 }}>target score</Text>
                <TextInput style={[inp, { width: 90, textAlign: "center" }]} value={String(l.targetScore)} keyboardType="number-pad" onChangeText={(v) => upd({ targetScore: num(v) })} accessibilityLabel={`${l.name} target score`} />
              </Row>
              <Stepper label={d.kind === "explorer" ? "treasures" : "spawn rate"} value={l.spawnRate} min={1} max={10} onChange={(spawnRate) => upd({ spawnRate })} />
              <Stepper label="danger speed" value={l.hazardSpeed} min={1} max={10} onChange={(hazardSpeed) => upd({ hazardSpeed })} />
            </View>
          );
        })}
        {d.levels.length < 10 ? (
          <Button size="sm" variant="ghost" title="+ Add level" onPress={() => {
            const last = d.levels[d.levels.length - 1];
            set({ levels: [...d.levels, { name: `Level ${d.levels.length + 1}`, targetScore: (last?.targetScore ?? 0) + 10, spawnRate: Math.min(10, (last?.spawnRate ?? 2) + 1), hazardSpeed: Math.min(10, (last?.hazardSpeed ?? 2) + 1) }] });
          }} />
        ) : null}
        <Muted>IF score ≥ target THEN next level</Muted>
      </Section>
      {d.kind === "quiz" && (
        <Section title="❓ Questions" concepts={["Data", "Conditions"]} focus={focus === "quiz"}>
          {d.quiz.map((q, i) => {
            const upd = (patch: Partial<typeof q>) => set({ quiz: d.quiz.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <View key={i} style={{ gap: 6, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Row wrap={false}>
                  <TextInput style={[inp, { flex: 1 }]} value={q.question} placeholder="Question" placeholderTextColor={C.ink3} onChangeText={(question) => upd({ question })} />
                  <Button size="sm" variant="danger" title="✕" onPress={() => set({ quiz: d.quiz.filter((_, j) => j !== i) })} />
                </Row>
                {q.options.map((o, k) => (
                  <Row key={k} wrap={false}>
                    <Chip tone="gray" selected={q.answer === k} label={q.answer === k ? "✓" : "○"} onPress={() => upd({ answer: k })} />
                    <TextInput style={[inp, { flex: 1 }]} value={o} onChangeText={(v) => upd({ options: q.options.map((y, m) => (m === k ? v : y)) })} />
                  </Row>
                ))}
                {q.options.length < 4 ? <Button size="sm" variant="ghost" title="+ option" onPress={() => upd({ options: [...q.options, ""] })} /> : null}
              </View>
            );
          })}
          <Button size="sm" variant="ghost" title="+ Add question" onPress={() => set({ quiz: [...d.quiz, { question: "", options: ["", ""], answer: 0, explanation: "" }] })} />
        </Section>
      )}
    </View>
  );
}

export function AppEditor({ spec, onSave, focus = "", saving, allowAiGuide }: { spec: AppSpec; onSave: (a: AppSpec) => void; focus?: string; saving?: boolean; allowAiGuide: boolean }) {
  const [d, setD] = useState(spec);
  const focusScreen = focus.startsWith("screens.") ? focus.slice(8) : "";
  const [sel, setSel] = useState(focusScreen || spec.startScreen);
  useEffect(() => setD(spec), [spec]);
  useEffect(() => {
    if (focusScreen) setSel(focusScreen);
  }, [focusScreen]);
  const dirty = JSON.stringify(d) !== JSON.stringify(spec);
  const screen = d.screens.find((x) => x.id === sel) ?? d.screens[0];
  const setScreen = (patch: Partial<AppSpec["screens"][number]>) => setD({ ...d, screens: d.screens.map((x) => (x.id === screen.id ? { ...x, ...patch } : x)) });
  const setBlock = (i: number, patch: Partial<AppSpec["screens"][number]["blocks"][number]>) => setScreen({ blocks: screen.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  return (
    <View style={{ gap: 12 }}>
      <SaveBar dirty={dirty} saving={saving} onUndo={() => setD(spec)} onSave={() => onSave(d)} />
      <Section title="📱 App" concepts={["User Interfaces"]} focus={focus === "startScreen"}>
        <Field label="Title" value={d.title} onChangeText={(title) => setD({ ...d, title })} />
        <Text style={{ fontWeight: "800", color: C.ink2 }}>Opens on screen</Text>
        <Row>{d.screens.map((x) => <Chip key={x.id} tone="gray" selected={d.startScreen === x.id} label={`${x.emoji} ${x.title}`} onPress={() => setD({ ...d, startScreen: x.id })} />)}</Row>
        <Text style={{ fontWeight: "800", color: C.ink2 }}>Color</Text>
        <Row>
          {["#5b3df5", "#3d63dd", "#30a46c", "#e5484d", "#d6409f", "#f76b15", "#a15c07", "#0e7490", "#334155"].map((col) => (
            <Pressable
              key={col}
              accessibilityRole="button"
              accessibilityLabel={`Color ${col}`}
              onPress={() => setD({ ...d, theme: { ...d.theme, color: col } })}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: col, borderWidth: d.theme.color === col ? 4 : 0, borderColor: C.sun }}
            />
          ))}
        </Row>
      </Section>
      <Section title="🧱 Screens" concepts={["Components", "Navigation"]} focus={!!focusScreen}>
        <Row>
          {d.screens.map((x) => <Chip key={x.id} tone="gray" selected={x.id === screen?.id} label={`${x.emoji} ${x.title}`} onPress={() => setSel(x.id)} />)}
          <Chip tone="sky" label="+ Screen" onPress={() => {
            let id = "new-screen";
            for (let n = 2; d.screens.some((x) => x.id === id); n++) id = `new-screen-${n}`;
            setD({ ...d, screens: [...d.screens, { id, title: "New screen", emoji: "✨", inNav: true, blocks: [blankBlock("heading", { text: "New screen" })] }] });
            setSel(id);
          }} />
        </Row>
        {screen ? (
          <>
            <Row wrap={false}>
              <TextInput style={[inp, { width: 56, textAlign: "center" }]} value={screen.emoji} onChangeText={(emoji) => setScreen({ emoji })} />
              <TextInput style={[inp, { flex: 1 }]} value={screen.title} onChangeText={(title) => setScreen({ title })} />
              <Chip tone="gray" selected={screen.inNav} label="menu" onPress={() => setScreen({ inNav: !screen.inNav })} />
            </Row>
            <Muted>Screen id: {screen.id} — buttons use this to find it.</Muted>
            {screen.blocks.map((b, i) => (
              <View key={i} style={{ backgroundColor: C.bg, borderRadius: 14, padding: 10, gap: 6 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Text style={{ fontWeight: "900" }}>{BLOCK_INFO[b.type].emoji} {BLOCK_INFO[b.type].label}</Text>
                  <Row>
                    <Button size="sm" variant="ghost" title="↑" onPress={() => { const arr = [...screen.blocks]; if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; setScreen({ blocks: arr }); } }} />
                    <Button size="sm" variant="danger" title="✕" onPress={() => setScreen({ blocks: screen.blocks.filter((_, j) => j !== i) })} />
                  </Row>
                </Row>
                {["heading", "text", "card", "button", "input", "aiGuide"].includes(b.type) ? <TextInput style={inp} value={b.text} placeholder="Text" placeholderTextColor={C.ink3} onChangeText={(text) => setBlock(i, { text })} /> : null}
                {["image", "card", "button", "aiGuide"].includes(b.type) ? <TextInput style={inp} value={b.emoji} placeholder="Emoji" placeholderTextColor={C.ink3} onChangeText={(emoji) => setBlock(i, { emoji })} /> : null}
                {b.type === "button" || b.type === "list" ? (
                  <Row>
                    <Muted>Goes to:</Muted>
                    {d.screens.map((x) => <Chip key={x.id} tone="gray" selected={b.goTo === x.id} label={x.title} onPress={() => setBlock(i, { goTo: x.id })} />)}
                    {b.goTo && !d.screens.some((x) => x.id === b.goTo) ? <Chip tone="coral" label={`❓ ${b.goTo} (missing)`} /> : null}
                  </Row>
                ) : null}
                {b.type === "list" || b.type === "search" ? (
                  <Row>
                    <Muted>Data:</Muted>
                    {d.collections.map((c) => <Chip key={c.name} tone="gray" selected={b.collection === c.name} label={c.name} onPress={() => setBlock(i, { collection: c.name })} />)}
                  </Row>
                ) : null}
                {b.type === "input" ? <TextInput style={inp} value={b.variable} placeholder="variable name" placeholderTextColor={C.ink3} onChangeText={(v) => setBlock(i, { variable: v.replace(/[^a-zA-Z0-9_]/g, "") })} /> : null}
              </View>
            ))}
            <Muted>Add a block:</Muted>
            <Row>
              {BLOCK_TYPES.filter((t) => t !== "aiGuide" || allowAiGuide).map((t) => (
                <Chip key={t} tone="gray" label={`${BLOCK_INFO[t].emoji} ${BLOCK_INFO[t].label}`} onPress={() => setScreen({ blocks: [...screen.blocks, blankBlock(t, t === "list" || t === "search" ? { collection: d.collections[0]?.name ?? "" } : t === "input" ? { variable: "name", text: "What's your name?" } : {})] })} />
              ))}
            </Row>
          </>
        ) : null}
      </Section>
      <Section title="🗂️ Data" concepts={["Data"]} focus={focus === "collections"}>
        {d.collections.map((c, ci) => (
          <View key={ci} style={{ gap: 6 }}>
            <Text style={{ fontWeight: "900" }}>{c.name} ({c.items.length})</Text>
            {c.items.map((it, ii) => {
              const upd = (patch: Partial<typeof it>) => setD({ ...d, collections: d.collections.map((x, j) => (j === ci ? { ...x, items: x.items.map((y, k) => (k === ii ? { ...y, ...patch } : y)) } : x)) });
              return (
                <View key={ii} style={{ backgroundColor: C.bg, borderRadius: 14, padding: 10, gap: 6 }}>
                  <Row wrap={false}>
                    <TextInput style={[inp, { width: 56, textAlign: "center" }]} value={it.emoji} onChangeText={(emoji) => upd({ emoji })} />
                    <TextInput style={[inp, { flex: 1 }]} value={it.title} onChangeText={(title) => upd({ title })} />
                    <Button size="sm" variant="danger" title="✕" onPress={() => setD({ ...d, collections: d.collections.map((x, j) => (j === ci ? { ...x, items: x.items.filter((_, k) => k !== ii) } : x)) })} />
                  </Row>
                  <TextInput style={inp} value={it.subtitle} placeholder="Subtitle" placeholderTextColor={C.ink3} onChangeText={(subtitle) => upd({ subtitle })} />
                  <TextInput style={[inp, { minHeight: 60 }]} multiline value={it.description} placeholder="Description" placeholderTextColor={C.ink3} onChangeText={(description) => upd({ description })} />
                  <TextInput style={[inp, { minHeight: 60 }]} multiline value={it.facts.join("\n")} placeholder="Facts (one per line)" placeholderTextColor={C.ink3} onChangeText={(v) => upd({ facts: v.split("\n").filter((f) => f.trim()) })} />
                </View>
              );
            })}
            <Button size="sm" variant="ghost" title="+ Add item" onPress={() => setD({ ...d, collections: d.collections.map((x, j) => (j === ci ? { ...x, items: [...x.items, { title: "New item", emoji: "⭐", subtitle: "", description: "", facts: [] }] } : x)) })} />
          </View>
        ))}
        {!d.collections.length ? <Button size="sm" variant="ghost" title="+ Add a collection" onPress={() => setD({ ...d, collections: [{ name: "items", items: [] }] })} /> : null}
      </Section>
    </View>
  );
}

export function SceneEditor({ spec, onSave, saving }: { spec: SceneSpec; onSave: (x: SceneSpec) => void; saving?: boolean }) {
  const [d, setD] = useState(spec);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setD(spec), [spec]);
  const dirty = JSON.stringify(d) !== JSON.stringify(spec);
  return (
    <View style={{ gap: 12 }}>
      <SaveBar dirty={dirty} saving={saving} onUndo={() => setD(spec)} onSave={() => onSave(d)} />
      <Muted>{sel === null ? "Tap something in the picture to pick it." : "Now tap anywhere in the picture to move it there."}</Muted>
      <SceneView scene={d} onChange={setD} selected={sel} onSelect={setSel} />
      <Card>
        <Field label="Title" value={d.title} onChangeText={(title) => setD({ ...d, title })} />
        <Field label="Caption" value={d.caption} onChangeText={(caption) => setD({ ...d, caption })} />
        {d.elements.map((el, i) => (
          <Row key={i} wrap={false}>
            <TextInput style={[inp, { width: 56, textAlign: "center" }]} value={el.emoji} onChangeText={(emoji) => setD({ ...d, elements: d.elements.map((x, j) => (j === i ? { ...x, emoji } : x)) })} />
            <TextInput style={[inp, { flex: 1 }]} value={el.label} placeholder="label" placeholderTextColor={C.ink3} onChangeText={(label) => setD({ ...d, elements: d.elements.map((x, j) => (j === i ? { ...x, label } : x)) })} />
            <Button size="sm" variant="ghost" title="−" onPress={() => setD({ ...d, elements: d.elements.map((x, j) => (j === i ? { ...x, size: Math.max(4, x.size - 3) } : x)) })} />
            <Button size="sm" variant="ghost" title="+" onPress={() => setD({ ...d, elements: d.elements.map((x, j) => (j === i ? { ...x, size: Math.min(40, x.size + 3) } : x)) })} />
            <Button size="sm" variant="danger" title="✕" onPress={() => setD({ ...d, elements: d.elements.filter((_, j) => j !== i) })} />
          </Row>
        ))}
        {d.elements.length < 14 ? <Button size="sm" variant="ghost" title="+ Add something" onPress={() => setD({ ...d, elements: [...d.elements, { emoji: "⭐", label: "", x: 50, y: 40, size: 12 }] })} /> : null}
      </Card>
    </View>
  );
}

export function StoryEditor({ spec, onSave, saving }: { spec: StorySpec; onSave: (x: StorySpec) => void; saving?: boolean }) {
  const [d, setD] = useState(spec);
  useEffect(() => setD(spec), [spec]);
  const dirty = JSON.stringify(d) !== JSON.stringify(spec);
  return (
    <View style={{ gap: 12 }}>
      <SaveBar dirty={dirty} saving={saving} onUndo={() => setD(spec)} onSave={() => onSave(d)} />
      <Field label="Title" value={d.title} onChangeText={(title) => setD({ ...d, title })} />
      {d.pages.map((p, i) => (
        <Card key={i}>
          <Row wrap={false}>
            <TextInput style={[inp, { width: 56, textAlign: "center" }]} value={p.emoji} onChangeText={(emoji) => setD({ ...d, pages: d.pages.map((x, j) => (j === i ? { ...x, emoji } : x)) })} />
            <H3>Page {i + 1}</H3>
          </Row>
          <TextInput style={[inp, { minHeight: 100, textAlignVertical: "top" }]} multiline value={p.text} onChangeText={(text) => setD({ ...d, pages: d.pages.map((x, j) => (j === i ? { ...x, text } : x)) })} />
          <Button size="sm" variant="danger" title="Remove page" onPress={() => setD({ ...d, pages: d.pages.filter((_, j) => j !== i) })} />
        </Card>
      ))}
      {d.pages.length < 10 ? <Button size="sm" variant="ghost" title="+ Add page" onPress={() => setD({ ...d, pages: [...d.pages, { text: "", emoji: "✨" }] })} /> : null}
      <Field label="The lesson" value={d.moral} onChangeText={(moral) => setD({ ...d, moral })} />
    </View>
  );
}

const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function CodeEditor({ spec, onSave, saving, errorLine }: { spec: CodeSpec; onSave: (x: CodeSpec) => void; saving?: boolean; errorLine?: number | null }) {
  const [src, setSrc] = useState(spec.source);
  const [title, setTitle] = useState(spec.title);
  useEffect(() => {
    setSrc(spec.source);
    setTitle(spec.title);
  }, [spec]);
  const dirty = src !== spec.source || title !== spec.title;
  const lines = src.split("\n");
  return (
    <View style={{ gap: 10 }}>
      <Field value={title} onChangeText={setTitle} accessibilityLabel="Title" />
      <Row>
        <Button size="sm" variant="ghost" title="Undo" disabled={!dirty} onPress={() => { setSrc(spec.source); setTitle(spec.title); }} />
        <Button size="sm" variant="mint" title={saving ? "Saving…" : "💾 Save & run"} disabled={!dirty || saving} onPress={() => onSave({ ...spec, title, source: src })} />
        {errorLine ? <Chip tone="coral" label={`🐛 Error on line ${errorLine}`} /> : null}
      </Row>
      {errorLine ? (
        <View style={{ backgroundColor: C.coralSoft, borderRadius: 12, padding: 10 }}>
          <Text style={{ fontFamily: mono, color: "#b3261e", fontSize: 13 }}>{errorLine}: {lines[errorLine - 1] ?? ""}</Text>
        </View>
      ) : null}
      <TextInput
        style={{ backgroundColor: "#16142a", color: "#e8e4ff", fontFamily: mono, fontSize: 13, lineHeight: 20, borderRadius: 16, padding: 14, minHeight: 420, textAlignVertical: "top" }}
        multiline
        value={src}
        onChangeText={setSrc}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        accessibilityLabel="Code editor"
      />
      <Muted>{lines.length} lines · game.onCollect, game.onHit, game.onFrame, game.say, game.spawn, game.nextLevel, game.win, game.over</Muted>
    </View>
  );
}
