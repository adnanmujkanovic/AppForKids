// BUILD mode for apps: screens made of building blocks, plus the data collections they show.
import { useEffect, useRef, useState } from "react";
import { BLOCK_INFO, BLOCK_TYPES, blankBlock, type AppBlock, type AppSpec, type BlockType } from "../../../shared/app";

export function AppEditor({ spec, onSave, focus = "", saving, allowAiGuide }: { spec: AppSpec; onSave: (s: AppSpec) => void; focus?: string; saving?: boolean; allowAiGuide: boolean }) {
  const [d, setD] = useState<AppSpec>(spec);
  const focusScreen = focus.startsWith("screens.") ? focus.slice(8) : "";
  const [sel, setSel] = useState(focusScreen || spec.startScreen || spec.screens[0]?.id);
  const blocksRef = useRef<HTMLDivElement>(null);
  useEffect(() => setD(spec), [spec]);
  useEffect(() => {
    if (focusScreen) {
      setSel(focusScreen);
      blocksRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusScreen]);
  const dirty = JSON.stringify(d) !== JSON.stringify(spec);
  const screen = d.screens.find((s) => s.id === sel) ?? d.screens[0];
  const setScreen = (patch: Partial<AppSpec["screens"][number]>) =>
    setD({ ...d, screens: d.screens.map((s) => (s.id === screen.id ? { ...s, ...patch } : s)) });
  const setBlock = (i: number, patch: Partial<AppBlock>) => setScreen({ blocks: screen.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const moveBlock = (i: number, dir: -1 | 1) => {
    const b = [...screen.blocks];
    const j = i + dir;
    if (j < 0 || j >= b.length) return;
    [b[i], b[j]] = [b[j], b[i]];
    setScreen({ blocks: b });
  };
  const screenOptions = d.screens.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.title}</option>);
  const collectionOptions = d.collections.map((c) => <option key={c.name} value={c.name}>{c.name}</option>);
  const palette = BLOCK_TYPES.filter((t) => t !== "aiGuide" || allowAiGuide);

  return (
    <div className="stack">
      <div className="row between card flat" style={{ position: "sticky", top: 64, zIndex: 5, padding: 12 }}>
        <span className="muted small" style={{ fontWeight: 800 }}>{dirty ? "✏️ You have unsaved changes" : "Change anything, then save a new version."}</span>
        <div className="row">
          <button className="btn ghost sm" disabled={!dirty} onClick={() => setD(spec)}>Undo</button>
          <button className="btn mint sm" disabled={!dirty || saving} onClick={() => onSave(d)}>{saving ? "Saving…" : "💾 Save version"}</button>
        </div>
      </div>

      <div className={`section ${focus === "startScreen" ? "focus" : ""}`}>
        <div className="head"><h3>📱 App</h3><span className="chip sky">User Interfaces</span>{focus === "startScreen" && <span className="chip coral">🐛 Look here</span>}</div>
        <div className="grid two">
          <label className="field">Title<input type="text" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></label>
          <label className="field">Opens on screen<select value={d.startScreen} onChange={(e) => setD({ ...d, startScreen: e.target.value })}>{screenOptions}{!d.screens.some((s) => s.id === d.startScreen) && <option value={d.startScreen}>❓ {d.startScreen}</option>}</select></label>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <label className="row small" style={{ fontWeight: 800 }}>Color <input type="color" value={d.theme.color} onChange={(e) => setD({ ...d, theme: { ...d.theme, color: e.target.value } })} /></label>
          <label className="row small" style={{ fontWeight: 800 }}>Icon <input type="text" style={{ width: 70 }} value={d.theme.emoji} onChange={(e) => setD({ ...d, theme: { ...d.theme, emoji: e.target.value } })} /></label>
        </div>
      </div>

      <div ref={blocksRef} className={`section ${focusScreen ? "focus" : ""}`}>
        <div className="head"><h3>🧱 Screens</h3><span className="chip sky">Components</span><span className="chip sky">Navigation</span>{focusScreen && <span className="chip coral">🐛 Look here</span>}</div>
        <div className="row" style={{ marginBottom: 12 }}>
          {d.screens.map((s) => (
            <button key={s.id} className={`chip ${s.id === screen?.id ? "selected" : ""}`} onClick={() => setSel(s.id)}>{s.emoji} {s.title}</button>
          ))}
          <button
            className="chip gray"
            onClick={() => {
              let id = "new-screen";
              for (let n = 2; d.screens.some((s) => s.id === id); n++) id = `new-screen-${n}`;
              setD({ ...d, screens: [...d.screens, { id, title: "New screen", emoji: "✨", inNav: true, blocks: [blankBlock("heading", { text: "New screen" })] }] });
              setSel(id);
            }}
          >
            + Screen
          </button>
        </div>
        {screen && (
          <>
            <div className="itemrow" style={{ gridTemplateColumns: "64px 1fr auto auto" }}>
              <input type="text" className="emo" value={screen.emoji} onChange={(e) => setScreen({ emoji: e.target.value })} aria-label="Screen icon" />
              <input type="text" value={screen.title} onChange={(e) => setScreen({ title: e.target.value })} aria-label="Screen title" />
              <label className="row small" style={{ gap: 4, fontWeight: 800 }}><input type="checkbox" checked={screen.inNav} onChange={(e) => setScreen({ inNav: e.target.checked })} /> in menu</label>
              <button className="btn danger sm" disabled={d.screens.length <= 1} onClick={() => { setD({ ...d, screens: d.screens.filter((s) => s.id !== screen.id) }); setSel(d.screens[0].id); }}>✕</button>
            </div>
            <p className="small muted">Screen id: <code>{screen.id}</code> — buttons use this to find it.</p>
            <div className="stack" style={{ gap: 8 }}>
              {screen.blocks.map((b, i) => (
                <div key={i} className="card flat" style={{ padding: 10 }}>
                  <div className="row between">
                    <b>{BLOCK_INFO[b.type].emoji} {BLOCK_INFO[b.type].label} <span className="chip sky" style={{ marginLeft: 4 }}>{BLOCK_INFO[b.type].concept}</span></b>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn ghost sm" onClick={() => moveBlock(i, -1)} aria-label="Move up">↑</button>
                      <button className="btn ghost sm" onClick={() => moveBlock(i, 1)} aria-label="Move down">↓</button>
                      <button className="btn danger sm" onClick={() => setScreen({ blocks: screen.blocks.filter((_, j) => j !== i) })}>✕</button>
                    </div>
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginTop: 8 }}>
                    {["heading", "text", "card", "button", "input", "aiGuide"].includes(b.type) && (
                      <input type="text" value={b.text} placeholder={b.type === "card" ? "Title|Body" : b.type === "input" ? "Label" : b.type === "aiGuide" ? "Persona, e.g. a friendly Mars expert" : "Text"} onChange={(e) => setBlock(i, { text: e.target.value })} />
                    )}
                    {["image", "card", "button", "aiGuide"].includes(b.type) && (
                      <input type="text" value={b.emoji} placeholder="Emoji" onChange={(e) => setBlock(i, { emoji: e.target.value })} />
                    )}
                    {(b.type === "button" || b.type === "list") && (
                      <select value={b.goTo} onChange={(e) => setBlock(i, { goTo: e.target.value })} aria-label="Goes to">
                        <option value="">{b.type === "list" ? "Tap does nothing" : "Choose a screen"}</option>
                        {screenOptions}
                        {b.goTo && !d.screens.some((s) => s.id === b.goTo) && <option value={b.goTo}>❓ {b.goTo} (missing)</option>}
                      </select>
                    )}
                    {(b.type === "list" || b.type === "search") && (
                      <select value={b.collection} onChange={(e) => setBlock(i, { collection: e.target.value })} aria-label="Collection">
                        <option value="">Choose data</option>
                        {collectionOptions}
                      </select>
                    )}
                    {b.type === "input" && (
                      <input type="text" value={b.variable} placeholder="variable name" onChange={(e) => setBlock(i, { variable: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} />
                    )}
                  </div>
                  <p className="small muted" style={{ margin: "6px 0 0" }}>{BLOCK_INFO[b.type].about}</p>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 10, gap: 6 }}>
              <span className="small muted" style={{ fontWeight: 800 }}>Add:</span>
              {palette.map((t: BlockType) => (
                <button key={t} className="chip gray" onClick={() => setScreen({ blocks: [...screen.blocks, blankBlock(t, t === "list" || t === "search" ? { collection: d.collections[0]?.name ?? "" } : t === "input" ? { variable: "name", text: "What's your name?" } : {})] })}>
                  {BLOCK_INFO[t].emoji} {BLOCK_INFO[t].label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={`section ${focus === "collections" ? "focus" : ""}`}>
        <div className="head"><h3>🗂️ Data</h3><span className="chip sky">Data</span></div>
        {d.collections.map((c, ci) => (
          <div key={ci} className="stack" style={{ gap: 8, marginBottom: 12 }}>
            <label className="field small">Collection name
              <input type="text" value={c.name} onChange={(e) => setD({ ...d, collections: d.collections.map((x, j) => (j === ci ? { ...x, name: e.target.value } : x)) })} />
            </label>
            {c.items.map((it, ii) => {
              const setItem = (patch: Partial<typeof it>) =>
                setD({ ...d, collections: d.collections.map((x, j) => (j === ci ? { ...x, items: x.items.map((y, k) => (k === ii ? { ...y, ...patch } : y)) } : x)) });
              return (
                <details key={ii} className="card flat" style={{ padding: 10 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 800 }}>{it.emoji} {it.title || "(untitled)"}</summary>
                  <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                    <div className="itemrow wide">
                      <input type="text" className="emo" value={it.emoji} onChange={(e) => setItem({ emoji: e.target.value })} />
                      <input type="text" value={it.title} placeholder="Title" onChange={(e) => setItem({ title: e.target.value })} />
                    </div>
                    <input type="text" value={it.subtitle} placeholder="Subtitle" onChange={(e) => setItem({ subtitle: e.target.value })} />
                    <textarea value={it.description} placeholder="Description" onChange={(e) => setItem({ description: e.target.value })} />
                    <textarea value={it.facts.join("\n")} placeholder="Facts (one per line)" onChange={(e) => setItem({ facts: e.target.value.split("\n").filter((f) => f.trim()) })} />
                    <button className="btn danger sm" onClick={() => setD({ ...d, collections: d.collections.map((x, j) => (j === ci ? { ...x, items: x.items.filter((_, k) => k !== ii) } : x)) })}>Remove item</button>
                  </div>
                </details>
              );
            })}
            <button className="btn ghost sm" onClick={() => setD({ ...d, collections: d.collections.map((x, j) => (j === ci ? { ...x, items: [...x.items, { title: "New item", emoji: "⭐", subtitle: "", description: "", facts: [] }] } : x)) })}>
              + Add item
            </button>
          </div>
        ))}
        {!d.collections.length && (
          <button className="btn ghost sm" onClick={() => setD({ ...d, collections: [{ name: "items", items: [] }] })}>+ Add a collection</button>
        )}
      </div>
    </div>
  );
}
