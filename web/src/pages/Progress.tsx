import { useState } from "react";
import { Link } from "react-router-dom";
import { api, errorText } from "../api";
import { useRewards, type Rewards } from "../components/rewards";
import { ErrorBox, Loading, Note, useLoad } from "../components/ui";
import { CONCEPTS, CREATOR_LEVELS, MEDALS, MISSIONS, type ProjectSummary, type ProjectType } from "../../../shared/types";
import { ProjectGrid } from "./Kid";

interface MissionState {
  id: string;
  steps: { title: string; task: string; done: boolean }[];
  complete: boolean;
  current: number;
}

const STEP_LINKS: Record<string, string> = {
  ask: "/kid/explore",
  image: "/kid/create",
  game: "/kid/build",
  gamekind: "/kid/build?kind=catcher&idea=Catch%20falling%20stars",
  app: "/kid/apps",
  aiguide: "/kid/apps?idea=A%20Mars%20explorer%20with%20an%20AI%20guide",
  detective: "/kid/detective",
  played: "/kid/creations",
  codeproject: "/kid/code",
  codechanged: "/kid/creations",
  coderan: "/kid/creations",
  friendsent: "/kid/creations",
  team: "/kid/friends",
  taskdone: "/kid/friends",
  version: "/kid/creations",
  deployed: "/kid/creations",
};

export function Missions() {
  const { data, error } = useLoad(() => api.get<MissionState[]>("/kid/missions"));
  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  return (
    <div className="stack narrow">
      <h1>🚀 Missions</h1>
      <p className="muted">Guided challenges. Steps complete themselves when you do them for real — anywhere in SparkForge.</p>
      {MISSIONS.map((m) => {
        const st = data.find((s) => s.id === m.id)!;
        const done = st.steps.filter((s) => s.done).length;
        return (
          <div key={m.id} className={`card stack ${st.complete ? "tint-mint" : ""}`}>
            <div className="row between">
              <h2 style={{ margin: 0 }}>{m.emoji} {m.title}</h2>
              {st.complete ? <span className="chip mint">🏅 Complete!</span> : <span className="chip gray">{done}/{m.steps.length}</span>}
            </div>
            <p className="muted" style={{ margin: 0 }}>{m.about}</p>
            <div className="progress"><i style={{ width: `${(done / m.steps.length) * 100}%` }} /></div>
            <div className="stack" style={{ gap: 6 }}>
              {m.steps.map((s, i) => {
                const state = st.steps[i];
                const now = i === st.current;
                const link = STEP_LINKS[s.check.split(":")[0]];
                return (
                  <div key={i} className="check" style={{ background: state.done ? "var(--mint-soft)" : now ? "var(--violet-soft)" : "var(--bg)" }}>
                    <span>{state.done ? "✅" : now ? "👉" : "⬜"}</span>
                    <span style={{ flex: 1 }}>
                      <b>Level {i + 1} — {s.title}</b><br />
                      <span className="small" style={{ fontWeight: 600 }}>{s.task}</span>
                    </span>
                    {now && link && <Link to={link} className="btn sm">Go</Link>}
                  </div>
                );
              })}
            </div>
            <div className="row" style={{ gap: 6 }}>{m.skills.map((s) => <span key={s} className="chip sky">{s}</span>)}</div>
          </div>
        );
      })}
    </div>
  );
}

interface Passport {
  name: string;
  avatar: string;
  level: string;
  medals: { medal_id: string; created_at: string }[];
  skills: { concept: string; created_at: string }[];
  stats: { projects: number; games: number; apps: number; creations: number; bugsFixed: number; shares: number };
}

export function PassportPage() {
  const { data, error } = useLoad(() => api.get<Passport>("/kid/passport"));
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  const have = new Set(data.medals.map((m) => m.medal_id));
  const li = CREATOR_LEVELS.findIndex((l) => l.id === data.level);
  return (
    <div className="stack">
      <div className="card tint-violet">
        <div className="row">
          <span className="avatar lg">{data.avatar}</span>
          <div>
            <span className="small muted" style={{ fontWeight: 900, letterSpacing: 1 }}>CREATOR PASSPORT</span>
            <h1 style={{ margin: 0 }}>{data.name}</h1>
          </div>
        </div>
        <div className="grid small" style={{ marginTop: 16 }}>
          {[
            ["🏅", data.medals.length, "Medals"],
            ["📦", data.stats.projects, "Projects"],
            ["🎮", data.stats.games, "Games"],
            ["📱", data.stats.apps, "Apps"],
            ["🎨", data.stats.creations, "Pictures & stories"],
            ["🐛", data.stats.bugsFixed, "Bugs fixed"],
          ].map(([e, n, l]) => (
            <div key={String(l)} className="card flat center" style={{ padding: 12 }}><div style={{ fontSize: "1.4rem" }}>{e}</div><h2 style={{ margin: 0 }}>{n}</h2><span className="small muted">{l}</span></div>
          ))}
        </div>
      </div>

      <h2>Creator level</h2>
      <div className="levels">
        {CREATOR_LEVELS.map((l, i) => (
          <div key={l.id} id={l.id} className={`lv ${i < li ? "reached" : ""} ${i === li ? "current" : ""}`} title={l.about}>
            <span className="e">{l.emoji}</span>{l.label}
          </div>
        ))}
      </div>
      <p className="small muted">{CREATOR_LEVELS[li].about}. Levels grow with what you can do — not your age.</p>

      <h2>Medals</h2>
      <div className="grid small">
        {MEDALS.map((m) => {
          const got = have.has(m.id);
          if (m.hidden && !got) return <div key={m.id} className="medal locked"><div className="e">🎁</div><b>???</b><span className="small muted">A surprise to discover</span></div>;
          return (
            <div key={m.id} className={`medal ${got ? "" : "locked"}`}>
              <div className="e">{m.emoji}</div>
              <b>{m.title}</b>
              <span className="small muted">{m.future ? "Coming soon" : m.about}</span>
            </div>
          );
        })}
      </div>

      <h2>Skills discovered</h2>
      {data.skills.length === 0 && <p className="muted">Build something to discover your first engineering concept!</p>}
      <div className="row" style={{ gap: 8 }}>
        {data.skills.map((s) => (
          <button key={s.concept} className={`chip ${open === s.concept ? "selected" : "sky"}`} onClick={() => setOpen(open === s.concept ? null : s.concept)}>
            {CONCEPTS[s.concept]?.emoji} {s.concept}
          </button>
        ))}
      </div>
      {open && CONCEPTS[open] && <div className="card flat tint-sky">{CONCEPTS[open].emoji} <b>{open}:</b> {CONCEPTS[open].older}</div>}
    </div>
  );
}

export function Creations() {
  const { data, error } = useLoad(() => api.get<ProjectSummary[]>("/kid/projects"));
  const [filter, setFilter] = useState<ProjectType | "all">("all");
  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  const shown = data.filter((p) => filter === "all" || p.type === filter);
  return (
    <div className="stack">
      <h1>📦 My Creations</h1>
      <div className="row" style={{ gap: 6 }}>
        {(["all", "game", "app", "image", "story"] as const).map((f) => (
          <button key={f} className={`chip ${filter === f ? "selected" : "gray"}`} onClick={() => setFilter(f)}>
            {f === "all" ? "Everything" : f === "game" ? "🎮 Games" : f === "app" ? "📱 Apps" : f === "image" ? "🎨 Pictures" : "📖 Stories"}
          </button>
        ))}
      </div>
      {shown.length ? <ProjectGrid projects={shown} /> : (
        <div className="card center stack">
          <div style={{ fontSize: "3rem" }}>✨</div>
          <h3>Nothing here yet</h3>
          <div className="row" style={{ justifyContent: "center" }}>
            <Link to="/kid/create" className="btn">🎨 Make a picture</Link>
            <Link to="/kid/build" className="btn coral">🎮 Build a game</Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function Detective() {
  const showRewards = useRewards();
  const [topic, setTopic] = useState("");
  const [c, setC] = useState<{ id: string; topic: string; statements: string[]; note?: string } | null>(null);
  const [answer, setAnswer] = useState<{ picked: number; correct: boolean; wrong: number; correction: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setErr(null);
    setAnswer(null);
    try {
      setC(await api.post("/kid/detective", { topic }));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="narrow stack">
      <h1>🕵️ AI Detective</h1>
      <div className="card tint-sun">
        <p style={{ margin: 0 }}>AI can sound confident and still be wrong. One of these three statements has a mistake hiding in it. Can you find it?</p>
      </div>
      <div className="card stack">
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (e.g. Mars, dinosaurs, oceans)" maxLength={60} />
          <button className="btn" onClick={start} disabled={busy}>{busy ? "…" : c ? "New case" : "Open a case"}</button>
        </div>
        {err && <div className="error">{err}</div>}
      </div>
      {c && (
        <div className="card stack">
          <h3>Case file: {c.topic}</h3>
          {c.statements.map((s, i) => {
            const isWrong = answer && i === answer.wrong;
            const picked = answer && i === answer.picked;
            return (
              <button
                key={i}
                className="toggle"
                style={{ textAlign: "left", background: isWrong ? "var(--coral-soft)" : picked ? "var(--sun-soft)" : undefined }}
                disabled={!!answer}
                onClick={async () => {
                  const r = await api.post<{ correct: boolean; wrong: number; correction: string; rewards: Rewards }>(`/kid/detective/${c.id}/answer`, { index: i });
                  setAnswer({ picked: i, ...r });
                  showRewards(r.rewards);
                }}
              >
                <span style={{ fontSize: "1.3rem" }}>{isWrong ? "🚨" : answer ? "✅" : "🔎"}</span>
                <span style={{ fontWeight: 700 }}>{s}</span>
              </button>
            );
          })}
          {answer && (
            <div className={answer.correct ? "card flat tint-mint" : "note"} style={{ padding: 14 }}>
              <b>{answer.correct ? "🎉 You caught the mistake!" : "Not quite — the mistake was the red one."}</b>
              <p style={{ margin: "6px 0 0" }}>{answer.correction}</p>
            </div>
          )}
          <Note>{c.note}</Note>
          <p className="small muted" style={{ margin: 0 }}>Detective tip: when something surprises you, check it with a trusted source.</p>
        </div>
      )}
    </div>
  );
}
