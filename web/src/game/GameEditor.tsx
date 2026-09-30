// BUILD mode for games: every part of the game model, editable by hand, labeled with the concept it teaches.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GAME_KIND_INFO, GAME_KINDS, type GameSpec } from "../../../shared/game";

export function focusSection(where: string | undefined): string {
  if (!where) return "";
  const head = where.split(".")[0];
  return head === "theme" ? "look" : head;
}

function Section({ id, title, concepts, focus, children }: { id: string; title: string; concepts: string[]; focus: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus === id) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus, id]);
  return (
    <div ref={ref} className={`section ${focus === id ? "focus" : ""}`}>
      <div className="head">
        <h3>{title}</h3>
        {concepts.map((c) => (
          <span key={c} className="chip sky">{c}</span>
        ))}
        {focus === id && <span className="chip coral">🐛 Look here</span>}
      </div>
      {children}
    </div>
  );
}

const num = (v: string, fb = 0) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : fb);

export function GameEditor({ spec, onSave, focus = "", saving }: { spec: GameSpec; onSave: (s: GameSpec) => void; focus?: string; saving?: boolean }) {
  const [d, setD] = useState<GameSpec>(spec);
  useEffect(() => setD(spec), [spec]);
  const dirty = JSON.stringify(d) !== JSON.stringify(spec);
  const set = (patch: Partial<GameSpec>) => setD({ ...d, ...patch });

  return (
    <div className="stack">
      <div className="row between card flat" style={{ position: "sticky", top: 64, zIndex: 5, padding: 12 }}>
        <span className="muted small" style={{ fontWeight: 800 }}>{dirty ? "✏️ You have unsaved changes" : "Change anything, then save a new version."}</span>
        <div className="row">
          <button className="btn ghost sm" disabled={!dirty} onClick={() => setD(spec)}>Undo</button>
          <button className="btn mint sm" disabled={!dirty || saving} onClick={() => onSave(d)}>{saving ? "Saving…" : "💾 Save version"}</button>
        </div>
      </div>

      <Section id="basics" title="🎯 The game" concepts={["Game Design"]} focus={focus}>
        <div className="grid two">
          <label className="field">Title<input type="text" value={d.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} /></label>
          <label className="field">Type
            <select value={d.kind} onChange={(e) => set({ kind: e.target.value as GameSpec["kind"] })}>
              {GAME_KINDS.map((k) => <option key={k} value={k}>{GAME_KIND_INFO[k].emoji} {GAME_KIND_INFO[k].label}</option>)}
            </select>
          </label>
        </div>
        <label className="field" style={{ marginTop: 10 }}>Goal<input type="text" value={d.goal} maxLength={200} onChange={(e) => set({ goal: e.target.value })} /></label>
      </Section>

      <Section id="player" title="🕹️ Player" concepts={["Variables", "Movement"]} focus={focus}>
        <div className="itemrow wide">
          <input type="text" className="emo" value={d.player.emoji} onChange={(e) => set({ player: { ...d.player, emoji: e.target.value } })} aria-label="Player emoji" />
          <input type="text" value={d.player.name} onChange={(e) => set({ player: { ...d.player, name: e.target.value } })} aria-label="Player name" />
        </div>
        <label className="field">speed = {d.player.speed}
          <input type="range" min={0} max={10} value={d.player.speed} onChange={(e) => set({ player: { ...d.player, speed: num(e.target.value) } })} />
        </label>
        <p className="small muted">Each frame the game does <code>position = position + speed</code>. What happens at 0?</p>
      </Section>

      <Section id="collectibles" title="⭐ Things to collect" concepts={["Data", "Variables"]} focus={focus}>
        {d.collectibles.map((c, i) => (
          <div key={i} className="card flat" style={{ padding: 10, marginBottom: 8 }}>
            <div className="itemrow">
              <input type="text" className="emo" value={c.emoji} onChange={(e) => set({ collectibles: d.collectibles.map((x, j) => (j === i ? { ...x, emoji: e.target.value } : x)) })} aria-label="Emoji" />
              <input type="text" value={c.name} onChange={(e) => set({ collectibles: d.collectibles.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} aria-label="Name" />
              <input type="number" value={c.points} title="points" onChange={(e) => set({ collectibles: d.collectibles.map((x, j) => (j === i ? { ...x, points: num(e.target.value) } : x)) })} aria-label="Points" />
              <button className="btn danger sm" onClick={() => set({ collectibles: d.collectibles.filter((_, j) => j !== i) })}>✕</button>
            </div>
            <input type="text" placeholder="A true fact players learn when they collect it" value={c.fact} onChange={(e) => set({ collectibles: d.collectibles.map((x, j) => (j === i ? { ...x, fact: e.target.value } : x)) })} />
          </div>
        ))}
        {d.collectibles.length < 8 && <button className="btn ghost sm" onClick={() => set({ collectibles: [...d.collectibles, { emoji: "⭐", name: "Star", points: 1, fact: "" }] })}>+ Add collectible</button>}
        <p className="small muted" style={{ marginTop: 8 }}>When the player touches one: <code>score = score + points</code></p>
      </Section>

      <Section id="hazards" title="⚠️ Dangers" concepts={["Collisions", "Events"]} focus={focus}>
        {d.hazards.map((h, i) => (
          <div key={i} className="itemrow">
            <input type="text" className="emo" value={h.emoji} onChange={(e) => set({ hazards: d.hazards.map((x, j) => (j === i ? { ...x, emoji: e.target.value } : x)) })} aria-label="Emoji" />
            <input type="text" value={h.name} onChange={(e) => set({ hazards: d.hazards.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} aria-label="Name" />
            <label className="row small" style={{ gap: 4, fontWeight: 800 }}>
              <input type="checkbox" checked={h.moves} onChange={(e) => set({ hazards: d.hazards.map((x, j) => (j === i ? { ...x, moves: e.target.checked } : x)) })} /> moves
            </label>
            <button className="btn danger sm" onClick={() => set({ hazards: d.hazards.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        {d.hazards.length < 6 && <button className="btn ghost sm" onClick={() => set({ hazards: [...d.hazards, { emoji: "🪨", name: "Rock", moves: false }] })}>+ Add danger</button>}
        <p className="small muted" style={{ marginTop: 8 }}>On collision: <code>lives = lives - 1</code></p>
      </Section>

      <Section id="rules" title="📏 Rules" concepts={["Conditions", "Timers"]} focus={focus}>
        <div className="grid two">
          <label className="field">lives = {d.rules.lives}
            <input type="range" min={0} max={10} value={d.rules.lives} onChange={(e) => set({ rules: { ...d.rules, lives: num(e.target.value) } })} />
          </label>
          <label className="field">timer = {d.rules.timeLimit ? `${d.rules.timeLimit}s` : "off"}
            <input type="range" min={0} max={180} step={5} value={d.rules.timeLimit} onChange={(e) => set({ rules: { ...d.rules, timeLimit: num(e.target.value) } })} />
          </label>
        </div>
        <p className="small muted"><code>IF lives == 0 THEN game over</code> · <code>IF timer == 0 AND score &lt; target THEN game over</code></p>
      </Section>

      <Section id="levels" title="🪜 Levels" concepts={["Loops", "Conditions"]} focus={focus}>
        {d.levels.map((l, i) => (
          <div key={i} className="card flat" style={{ padding: 10, marginBottom: 8 }}>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input type="text" value={l.name} onChange={(e) => set({ levels: d.levels.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} aria-label="Level name" />
              <button className="btn danger sm" onClick={() => set({ levels: d.levels.filter((_, j) => j !== i) })}>✕</button>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", marginTop: 8, gap: 10 }}>
              <label className="field small">target score
                <input type="number" value={l.targetScore} onChange={(e) => set({ levels: d.levels.map((x, j) => (j === i ? { ...x, targetScore: num(e.target.value) } : x)) })} />
              </label>
              <label className="field small">{d.kind === "explorer" ? "treasures" : "spawn rate"} {l.spawnRate}
                <input type="range" min={1} max={10} value={l.spawnRate} onChange={(e) => set({ levels: d.levels.map((x, j) => (j === i ? { ...x, spawnRate: num(e.target.value, 1) } : x)) })} />
              </label>
              <label className="field small">danger speed {l.hazardSpeed}
                <input type="range" min={1} max={10} value={l.hazardSpeed} onChange={(e) => set({ levels: d.levels.map((x, j) => (j === i ? { ...x, hazardSpeed: num(e.target.value, 1) } : x)) })} />
              </label>
            </div>
          </div>
        ))}
        {d.levels.length < 10 && (
          <button
            className="btn ghost sm"
            onClick={() => {
              const last = d.levels[d.levels.length - 1];
              set({ levels: [...d.levels, { name: `Level ${d.levels.length + 1}`, targetScore: (last?.targetScore ?? 0) + 10, spawnRate: Math.min(10, (last?.spawnRate ?? 2) + 1), hazardSpeed: Math.min(10, (last?.hazardSpeed ?? 2) + 1) }] });
            }}
          >
            + Add level
          </button>
        )}
        <p className="small muted" style={{ marginTop: 8 }}>The game loops through levels: <code>IF score &gt;= target THEN next level</code></p>
      </Section>

      {d.kind === "quiz" && (
        <Section id="quiz" title="❓ Questions" concepts={["Data", "Conditions"]} focus={focus}>
          {d.quiz.map((q, i) => (
            <div key={i} className="card flat" style={{ padding: 10, marginBottom: 8 }}>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input type="text" value={q.question} placeholder="Question" onChange={(e) => set({ quiz: d.quiz.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) })} />
                <button className="btn danger sm" onClick={() => set({ quiz: d.quiz.filter((_, j) => j !== i) })}>✕</button>
              </div>
              {q.options.map((o, k) => (
                <div key={k} className="row" style={{ marginTop: 6, flexWrap: "nowrap" }}>
                  <input type="radio" name={`ans${i}`} checked={q.answer === k} onChange={() => set({ quiz: d.quiz.map((x, j) => (j === i ? { ...x, answer: k } : x)) })} aria-label="Correct answer" />
                  <input type="text" value={o} onChange={(e) => set({ quiz: d.quiz.map((x, j) => (j === i ? { ...x, options: x.options.map((y, m) => (m === k ? e.target.value : y)) } : x)) })} />
                </div>
              ))}
              {q.options.length < 4 && <button className="linkbtn small" style={{ marginTop: 6 }} onClick={() => set({ quiz: d.quiz.map((x, j) => (j === i ? { ...x, options: [...x.options, ""] } : x)) })}>+ option</button>}
            </div>
          ))}
          <button className="btn ghost sm" onClick={() => set({ quiz: [...d.quiz, { question: "", options: ["", ""], answer: 0, explanation: "" }] })}>+ Add question</button>
        </Section>
      )}

      <Section id="look" title="🎨 Look" concepts={["User Interfaces"]} focus={focus}>
        <div className="row">
          <label className="row small" style={{ fontWeight: 800 }}>Sky <input type="color" value={d.theme.sky} onChange={(e) => set({ theme: { ...d.theme, sky: e.target.value } })} /></label>
          <label className="row small" style={{ fontWeight: 800 }}>Ground <input type="color" value={d.theme.ground} onChange={(e) => set({ theme: { ...d.theme, ground: e.target.value } })} /></label>
          <label className="field small" style={{ flex: 1, minWidth: 160 }}>Decorations
            <input type="text" value={d.theme.decorations.join(" ")} onChange={(e) => set({ theme: { ...d.theme, decorations: e.target.value.split(/\s+/).filter(Boolean) } })} />
          </label>
        </div>
      </Section>
    </div>
  );
}
