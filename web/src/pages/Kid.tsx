import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useRewards, type Rewards } from "../components/rewards";
import { ChatPanel } from "../components/ChatPanel";
import { Building, ErrorBox, Loading, Note, TYPE_INFO, timeAgo, useLoad } from "../components/ui";
import { CREATOR_LEVELS, HELP_LEVELS, type HelpLevel, type Permissions, type ProjectSummary } from "../../../shared/types";
import { GAME_KIND_INFO, GAME_KINDS, type GameKind } from "../../../shared/game";

interface Home {
  child: { id: string; name: string; age: number; avatar: string; interests: string[]; helpLevel: HelpLevel; permissions: Permissions };
  level: string;
  journey: { asked: boolean; image: boolean; game: boolean; played: boolean };
  projects: ProjectSummary[];
}

export function useHome() {
  return useLoad(() => api.get<Home>("/kid/home"));
}

export function HelpLevelPicker({ value, onChange }: { value: HelpLevel; onChange: (h: HelpLevel) => void }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {HELP_LEVELS.map((h) => (
        <button key={h.id} className={`chip ${value === h.id ? "selected" : "gray"}`} title={h.about} onClick={() => onChange(h.id)}>
          {h.emoji} {h.label}
        </button>
      ))}
    </div>
  );
}

export function KidHome() {
  const { data, error, reload } = useHome();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  const { child, journey } = data;
  const p = child.permissions;
  const level = CREATOR_LEVELS.find((l) => l.id === data.level)!;
  const steps = [
    { done: journey.asked, label: "🔭 Ask a question", to: "/kid/explore" },
    { done: journey.image, label: "🎨 Make a picture", to: "/kid/create" },
    { done: journey.game, label: "🎮 Build a game", to: "/kid/build" },
    { done: journey.played, label: "▶ Play it!", to: "/kid/creations" },
  ];
  const firstOpen = steps.findIndex((s) => !s.done);
  const tiles = [
    { to: "/kid/explore", ic: "🔭", t: "Explore", s: "Ask anything", ok: p.aiQuestions },
    { to: "/kid/create", ic: "🎨", t: "Create", s: "Pictures & stories", ok: p.imageGeneration || p.storyCreation },
    { to: "/kid/build", ic: "🎮", t: "Build a game", s: "Make it playable", ok: p.gameCreation },
    { to: "/kid/apps", ic: "🛠️", t: "Make an app", s: "Screens, data, buttons", ok: p.appCreation },
    { to: "/kid/code", ic: "⌨️", t: "Code Mode", s: "Real JavaScript", ok: p.codeMode },
    { to: "/kid/learn", ic: "📚", t: "Learn", s: "Homework helper", ok: p.aiQuestions },
    { to: "/kid/plans", ic: "🗓️", t: "Planner", s: "Big things, small steps", ok: p.aiQuestions },
    { to: "/kid/friends", ic: "🤝", t: "Friends", s: "Sent to me · together", ok: p.friends },
    { to: "/kid/feed", ic: "🌍", t: "Creator Feed", s: "What others made", ok: p.seeFeed },
    { to: "/kid/missions", ic: "🚀", t: "Missions", s: "Guided challenges", ok: true },
    { to: "/kid/detective", ic: "🕵️", t: "AI Detective", s: "Catch AI mistakes", ok: p.aiQuestions },
    { to: "/kid/passport", ic: "🏆", t: "Achievements", s: "Creator Passport", ok: true },
    { to: "/kid/creations", ic: "📦", t: "My Creations", s: `${data.projects.length ? "Everything you made" : "Empty — for now!"}`, ok: true },
  ];
  return (
    <div className="stack" style={{ gap: 22 }}>
      <section className="hero-ask">
        <div className="row between">
          <span className="chip" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>{level.emoji} {level.label}</span>
        </div>
        <h1 style={{ marginTop: 10 }}>Hi {child.name} {child.avatar} What are you curious about?</h1>
        <form className="askbar" onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(`/kid/explore?q=${encodeURIComponent(q)}`); }}>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Why is Mars red?" aria-label="Ask a question" />
          <button className="btn">Ask ✨</button>
        </form>
        {child.interests.length > 0 && (
          <div className="row" style={{ marginTop: 12, gap: 6 }}>
            {child.interests.map((i) => (
              <button key={i} className="chip" style={{ background: "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer" }} onClick={() => nav(`/kid/explore?q=${encodeURIComponent(`Tell me something amazing about ${i}`)}`)}>
                {i}
              </button>
            ))}
          </div>
        )}
      </section>

      {firstOpen >= 0 && (
        <section className="card stack">
          <h3>🌟 Your first creation — about 15 minutes</h3>
          <div className="journey">
            {steps.map((s, i) => (
              <Link key={i} to={s.to} className={`step ${s.done ? "done" : i === firstOpen ? "now" : ""}`}>
                {s.done ? "✅ " : `${i + 1}. `}{s.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="tiles">
        {tiles.map((t) => (
          <Link key={t.to} to={t.ok ? t.to : "#"} className={`tile ${t.ok ? "" : "locked"}`} onClick={(e) => !t.ok && e.preventDefault()}>
            <span className="ic">{t.ic}</span>
            <b>{t.t}</b>
            <span>{t.ok ? t.s : "🔒 Ask a parent"}</span>
          </Link>
        ))}
      </section>

      <section className="card stack">
        <h3>🤖 How much should AI help?</h3>
        <HelpLevelPicker value={child.helpLevel} onChange={async (h) => { await api.patch("/kid/settings", { helpLevel: h }); reload(); }} />
        <p className="small muted" style={{ margin: 0 }}>{HELP_LEVELS.find((h) => h.id === child.helpLevel)?.about}. You can change this any time.</p>
      </section>

      {data.projects.length > 0 && (
        <section>
          <div className="row between"><h2>Recent creations</h2><Link to="/kid/creations">See all →</Link></div>
          <ProjectGrid projects={data.projects.slice(0, 4)} />
        </section>
      )}
    </div>
  );
}

export function ProjectGrid({ projects }: { projects: ProjectSummary[] }) {
  return (
    <div className="grid">
      {projects.map((p) => (
        <Link key={p.id} to={`/kid/project/${p.id}`} className="tile">
          <span className="ic">{p.emoji}</span>
          <b>{p.title}</b>
          <span>{TYPE_INFO[p.type].emoji} {TYPE_INFO[p.type].label} · v{p.version} · {timeAgo(p.updatedAt)}{p.remixedFrom ? " · 🔄 remix" : ""}</span>
        </Link>
      ))}
    </div>
  );
}

export function Explore() {
  const [params] = useSearchParams();
  return (
    <div className="narrow stack">
      <h1>🔭 Explore</h1>
      <ChatPanel
        thread="explore"
        initial={params.get("q")}
        placeholder="Ask me anything…"
        emptyState={
          <div className="card tint-violet">
            <h3>👋 I'm Spark, your AI mentor.</h3>
            <p>Ask me about anything you wonder about. After we explore, we can turn it into a picture, a game or an app!</p>
            <p className="small muted" style={{ margin: 0 }}>I'm an AI, so I can make mistakes. For important facts, double-check with a grown-up or a trusted website.</p>
          </div>
        }
      />
    </div>
  );
}

export function Learn() {
  const { data } = useHome();
  if (!data) return <Loading />;
  const mode = data.child.permissions.homeworkMode;
  const desc = {
    teach: "🔵 Teach mode: I'll explain and give you similar examples, but you'll find the answers yourself.",
    hints: "🟡 Hint mode: I'll give hints and check your work.",
    answers: "🟢 Answers allowed — I'll always show how to get there. Say “don't give me the answer” any time.",
  }[mode];
  return (
    <div className="narrow stack">
      <h1>📚 Learn</h1>
      <div className="card tint-sky"><p style={{ margin: 0 }}>{desc}</p></div>
      <ChatPanel
        thread="learn"
        placeholder="Type your homework question, like 24 x 3"
        allowImage={data.child.permissions.photoUpload}
        emptyState={<p className="muted center">What are you working on today? You can type the question{data.child.permissions.photoUpload ? " or add a photo of your worksheet 📷" : ""}.</p>}
      />
    </div>
  );
}

export function Create() {
  const [params] = useSearchParams();
  const { data } = useHome();
  const nav = useNavigate();
  const showRewards = useRewards();
  const [type, setType] = useState<"image" | "story">(params.get("type") === "story" ? "story" : "image");
  const [prompt, setPrompt] = useState(params.get("prompt") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!data) return <Loading />;
  const p = data.child.permissions;
  const ideas = type === "image"
    ? ["Put me on Mars", "A futuristic Mars city", "A robot explorer in a cave", "A dragon reading books under the stars", "My dream underwater house"]
    : ["A robot who is afraid of the dark", "A lion who wants to fly", "A tiny astronaut's first day on the Moon", "A volcano that sneezes glitter"];
  const allowed = type === "image" ? p.imageGeneration : p.storyCreation;
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ project: { id: string }; rewards: Rewards; note?: string }>(`/kid/create/${type}`, { prompt });
      showRewards(r.rewards);
      nav(`/kid/project/${r.project.id}`, { state: { note: r.note } });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };
  if (busy) return <Building emoji={type === "image" ? "🎨" : "📖"} label={type === "image" ? "Making your picture…" : "Writing your story…"} />;
  return (
    <div className="narrow stack">
      <h1>🎨 Create</h1>
      <div className="tabs">
        <button className={type === "image" ? "active" : ""} onClick={() => setType("image")}>🎨 Picture</button>
        <button className={type === "story" ? "active" : ""} onClick={() => setType("story")}>📖 Story</button>
      </div>
      {!allowed ? (
        <div className="card">🔒 This is turned off in your family settings. Ask a parent if you'd like to try it!</div>
      ) : (
        <div className="card stack">
          <label className="field">{type === "image" ? "Describe your picture" : "What's your story about?"}
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={ideas[0]} maxLength={type === "image" ? 300 : 400} />
          </label>
          <div className="row" style={{ gap: 6 }}>
            {ideas.map((i) => <button key={i} className="chip gray" onClick={() => setPrompt(i)}>{i}</button>)}
          </div>
          <p className="small muted" style={{ margin: 0 }}>💡 Tip: say who or what is in it, where it is, and how it should feel. {type === "image" && "Say “me” to put yourself in the picture!"}</p>
          <ErrorBox error={error} />
          <button className="btn big" disabled={prompt.trim().length < 2} onClick={go}>✨ {type === "image" ? "Make my picture" : "Write my story"}</button>
        </div>
      )}
    </div>
  );
}

const KIND_OPTIONS: Record<GameKind, string> = {
  catcher: "Collect things (catch what falls, dodge dangers)",
  explorer: "Explore (move around and find treasures)",
  quiz: "Answer questions",
};

export function BuildGame() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const showRewards = useRewards();
  const [idea, setIdea] = useState(params.get("idea") ?? "");
  const [kind, setKind] = useState<GameKind | null>((params.get("kind") as GameKind) ?? null);
  const [step, setStep] = useState<"idea" | "kind">(params.get("idea") ? "kind" : "idea");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const build = async (k: GameKind) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ project: { id: string }; rewards: Rewards; note?: string }>("/kid/games", { idea, kind: k, topicNotes: params.get("notes") ?? "" });
      showRewards(r.rewards);
      nav(`/kid/project/${r.project.id}?tab=play`, { state: { note: r.note, fresh: true } });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };
  if (busy) return <Building emoji="🎮" label="Building your game…" />;
  return (
    <div className="narrow stack">
      <h1>🎮 Build a game</h1>
      {step === "idea" ? (
        <div className="card stack">
          <label className="field">What's your game about?
            <input type="text" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="A game about Mars" maxLength={300} />
          </label>
          <div className="row" style={{ gap: 6 }}>
            {["A game about Mars", "Catch falling stars", "Dinosaur egg hunt", "Ocean treasure dive", "Robot factory"].map((i) => (
              <button key={i} className="chip gray" onClick={() => setIdea(i)}>{i}</button>
            ))}
          </div>
          <button className="btn big" disabled={idea.trim().length < 2} onClick={() => setStep("kind")}>Next →</button>
        </div>
      ) : (
        <div className="card stack">
          <p className="muted" style={{ margin: 0 }}>“{idea}” <button className="linkbtn" onClick={() => setStep("idea")}>change</button></p>
          <h2>What should the player do?</h2>
          {GAME_KINDS.map((k) => (
            <button key={k} className={`toggle ${kind === k ? "" : ""}`} style={{ textAlign: "left", borderColor: kind === k ? "var(--violet)" : undefined }} onClick={() => { setKind(k); build(k); }}>
              <span style={{ fontSize: "2rem" }}>{GAME_KIND_INFO[k].emoji}</span>
              <span><b>{GAME_KIND_INFO[k].label}</b><br /><span className="small muted">{KIND_OPTIONS[k]}</span></span>
            </button>
          ))}
          <ErrorBox error={error} />
        </div>
      )}
    </div>
  );
}

interface Plan { title: string; emoji: string; pieces: { name: string; why: string; emoji: string }[]; question: string }

export function MakeApp() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const showRewards = useRewards();
  const [idea, setIdea] = useState(params.get("idea") ?? "");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [note, setNote] = useState<string | null>(null);
  const makePlan = async () => {
    setBusy("Planning your app…");
    setError(null);
    try {
      const r = await api.post<{ plan: Plan; note?: string }>("/kid/apps/plan", { idea });
      setPlan(r.plan);
      setNote(r.note ?? null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };
  const build = async () => {
    setBusy("Building your app…");
    setError(null);
    try {
      const r = await api.post<{ project: { id: string }; rewards: Rewards; note?: string }>("/kid/apps", { idea, plan });
      showRewards(r.rewards);
      nav(`/kid/project/${r.project.id}?tab=play`, { state: { note: r.note, fresh: true } });
    } catch (e) {
      setError(e);
      setBusy(null);
    }
  };
  if (busy) return <Building emoji="🛠️" label={busy} />;
  return (
    <div className="narrow stack">
      <h1>🛠️ Make an app</h1>
      {!plan ? (
        <div className="card stack">
          <label className="field">What app do you want to build?
            <input type="text" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="An app about African animals" maxLength={300} />
          </label>
          <div className="row" style={{ gap: 6 }}>
            {["An app about African animals", "A solar system explorer", "A Mars explorer with an AI guide", "A dinosaur encyclopedia"].map((i) => (
              <button key={i} className="chip gray" onClick={() => setIdea(i)}>{i}</button>
            ))}
          </div>
          <ErrorBox error={error} />
          <button className="btn big" disabled={idea.trim().length < 2} onClick={makePlan}>Plan it with AI →</button>
        </div>
      ) : (
        <div className="card stack">
          <h2>{plan.emoji} {plan.title}</h2>
          <p className="muted">Engineers plan before they build. Here's what our app needs:</p>
          {plan.pieces.map((pc, i) => (
            <div key={i} className="row between card flat" style={{ padding: 12 }}>
              <span><span style={{ fontSize: "1.4rem" }}>{pc.emoji}</span> <b>{pc.name}</b><br /><span className="small muted">{pc.why}</span></span>
              <button className="btn danger sm" onClick={() => setPlan({ ...plan, pieces: plan.pieces.filter((_, j) => j !== i) })} aria-label={`Remove ${pc.name}`}>✕</button>
            </div>
          ))}
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (extra.trim()) { setPlan({ ...plan, pieces: [...plan.pieces, { name: extra.trim(), why: "My idea!", emoji: "💡" }] }); setExtra(""); } }}>
            <input type="text" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Add your own piece (e.g. Quiz screen)" style={{ flex: 1 }} />
            <button className="btn ghost sm">+ Add</button>
          </form>
          <p className="muted" style={{ margin: 0 }}>💬 {plan.question}</p>
          <Note>{note}</Note>
          <ErrorBox error={error} />
          <div className="row">
            <button className="btn ghost" onClick={() => setPlan(null)}>← Change idea</button>
            <button className="btn big" onClick={build} disabled={!plan.pieces.length}>✅ Looks good — build it!</button>
          </div>
        </div>
      )}
    </div>
  );
}
