// The app runtime: renders an AppSpec's screens and building blocks inside a phone frame.
import { useState } from "react";
import type { AppBlock, AppItem, AppSpec } from "../../../shared/app";

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
      <div className="appcard">
        <b>{block.emoji || "🤖"} AI Guide</b>
        <p className="small muted" style={{ margin: "6px 0 0" }}>The AI guide works when you open this app inside SparkForge.</p>
      </div>
    );
  }
  const send = async () => {
    if (!q.trim() || busy) return;
    setBusy(true);
    const question = q;
    setQ("");
    try {
      const a = await ask(question);
      setLog((l) => [...l, { q: question, a }]);
    } catch (e) {
      setLog((l) => [...l, { q: question, a: e instanceof Error ? e.message : "Hmm, I couldn't answer that." }]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="appcard">
      <b>{block.emoji || "🤖"} I'm {block.text || "your guide"}!</b>
      <div className="stack" style={{ marginTop: 8, gap: 8 }}>
        {log.map((l, i) => (
          <div key={i} className="small">
            <div style={{ fontWeight: 800 }}>You: {l.q}</div>
            <div>{l.a}</div>
          </div>
        ))}
        {busy && <div className="typing"><i /><i /><i /></div>}
        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask me something…" />
          <button className="appbtn" style={{ background: color }} onClick={send} disabled={busy}>Ask</button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>🤖 AI answers can be wrong — check important facts.</p>
      </div>
    </div>
  );
}

export function AppPlayer({ spec, ask }: { spec: AppSpec; ask?: Ask }) {
  const [screenId, setScreen] = useState(spec.startScreen);
  const [item, setItem] = useState<AppItem | null>(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [search, setSearch] = useState<Record<string, string>>({});
  const screen = spec.screens.find((s) => s.id === screenId);
  const color = spec.theme.color;
  const go = (id: string) => {
    if (spec.screens.some((s) => s.id === id)) setScreen(id);
  };

  const block = (b: AppBlock, i: number) => {
    const key = `${screenId}-${i}`;
    switch (b.type) {
      case "heading":
        return <h2 key={key} style={{ margin: 0 }}>{fill(b.text, item, vars)}</h2>;
      case "text":
        return <p key={key} style={{ margin: 0 }}>{fill(b.text, item, vars)}</p>;
      case "image":
        return <div key={key} className="bigemoji">{fill(b.emoji || "🖼️", item, vars)}</div>;
      case "card": {
        const [title, ...rest] = fill(b.text, item, vars).split("|");
        return (
          <div key={key} className="appcard">
            <div style={{ fontSize: "1.6rem" }}>{b.emoji}</div>
            <b>{title}</b>
            {rest.length > 0 && <p style={{ margin: "4px 0 0" }}>{rest.join("|")}</p>}
          </div>
        );
      }
      case "button":
        return (
          <button key={key} className="appbtn" style={{ background: color }} onClick={() => go(b.goTo)}>
            {b.emoji} {b.text || "Go"}
          </button>
        );
      case "search":
        return (
          <input
            key={key}
            type="text"
            placeholder="🔍 Search…"
            value={search[screenId] ?? ""}
            onChange={(e) => setSearch({ ...search, [screenId]: e.target.value })}
          />
        );
      case "list": {
        const col = spec.collections.find((c) => c.name === b.collection);
        const q = (search[screenId] ?? "").toLowerCase();
        const items = (col?.items ?? []).filter((it) => !q || `${it.title} ${it.subtitle}`.toLowerCase().includes(q));
        if (!col?.items.length) return <p key={key} className="muted small">This list is empty.</p>;
        return (
          <div key={key} className="stack" style={{ gap: 8 }}>
            {items.map((it, j) => (
              <button
                key={j}
                className="listitem"
                onClick={() => {
                  setItem(it);
                  if (b.goTo) go(b.goTo);
                }}
              >
                <span className="e">{it.emoji}</span>
                <span>
                  <b>{it.title}</b>
                  <br />
                  <span className="small muted">{it.subtitle}</span>
                </span>
              </button>
            ))}
            {!items.length && <p className="muted small">Nothing matches “{q}”.</p>}
          </div>
        );
      }
      case "input":
        return (
          <label key={key} className="field">
            {b.text || "Type here"}
            <input type="text" value={vars[b.variable] ?? ""} onChange={(e) => setVars({ ...vars, [b.variable]: e.target.value })} />
          </label>
        );
      case "facts":
        return item?.facts.length ? (
          <ul key={key} className="facts">
            {item.facts.map((f, j) => (
              <li key={j}>💡 {f}</li>
            ))}
          </ul>
        ) : null;
      case "aiGuide":
        return <Guide key={key} block={b} ask={ask} color={color} />;
    }
  };

  const nav = spec.screens.filter((s) => s.inNav);
  return (
    <div className="phone">
      <div className="apptitle" style={{ background: color }}>
        <span style={{ fontSize: "1.3rem" }}>{spec.theme.emoji}</span> {spec.title}
      </div>
      <div className="screen">
        {screen ? screen.blocks.map(block) : <p className="muted">🐛 This screen doesn't exist: “{screenId}”.</p>}
      </div>
      {nav.length > 1 && (
        <div className="appnav">
          {nav.map((s) => (
            <button key={s.id} className={s.id === screenId ? "active" : ""} onClick={() => go(s.id)}>
              <span style={{ fontSize: "1.2rem" }}>{s.emoji}</span>
              {s.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
