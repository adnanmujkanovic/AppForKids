import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, errorText } from "../api";
import { useSession } from "../session";
import { useRewards, type Rewards } from "../components/rewards";
import { ErrorBox, Loading, Modal, Note, timeAgo, TYPE_INFO, useLoad } from "../components/ui";
import { ChatPanel } from "../components/ChatPanel";
import { SceneView } from "../components/SceneView";
import { GamePlayer } from "../game/GamePlayer";
import { AppPlayer } from "../game/AppPlayer";
import { GameEditor, focusSection } from "../game/GameEditor";
import { AppEditor } from "../game/AppEditor";
import { SceneEditor, StoryEditor, StoryView } from "../game/CreationEditors";
import { appCode, CodeBlock, gameCode } from "../game/codeView";
import { CONCEPTS, type JournalEntry, type Permissions, type Project, type ProjectVersion } from "../../../shared/types";
import type { GameBug, GameCheck, GameSpec } from "../../../shared/game";
import type { AppSpec } from "../../../shared/app";
import type { SceneSpec, StorySpec } from "../../../shared/creations";

interface Detail {
  project: Project;
  versions: ProjectVersion[];
  journal: JournalEntry[];
  shares: { token: string; audience: string; status: string; allowRemix: boolean; slug: string | null; views: number; plays: number; createdAt: string }[];
  concepts: string[];
  permissions: Permissions;
}

type Tab = "play" | "build" | "explain" | "code" | "test" | "share" | "history";

function Viewer({ p, onEnd, onStart }: { p: Project; onEnd?: (r: { result: string; score: number }) => void; onStart?: () => void }) {
  if (p.type === "game") return <GamePlayer key={p.version} spec={p.spec as GameSpec} onEnd={onEnd} onStart={onStart} />;
  if (p.type === "app") return <AppPlayer key={p.version} spec={p.spec as AppSpec} ask={async (question) => (await api.post<{ reply: string }>(`/kid/guide/${p.id}`, { question })).reply} />;
  if (p.type === "image") {
    const s = p.spec as SceneSpec;
    return (
      <div className="card scenecard" style={{ maxWidth: 640, margin: "0 auto", padding: 12 }}>
        <SceneView scene={s} />
        <p className="center" style={{ margin: "10px 0 0", fontWeight: 700 }}>{s.caption}</p>
        <p className="center small muted" style={{ margin: 0 }}>🤖 Composed by AI from your idea, drawn as emoji art.</p>
      </div>
    );
  }
  return <StoryView story={p.spec as StorySpec} />;
}

export function BugCard({ bug, onFix, onTry }: { bug: GameBug; onFix: () => Promise<void>; onTry: () => void }) {
  const [shown, setShown] = useState<"hint" | "why" | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="bugcard stack">
      <span className="chip coral">🐛 BUG FOUND</span>
      <h3 style={{ margin: 0 }}>{bug.title.replace(/^🐛\s*/, "")}</h3>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn sm mint" onClick={onTry}>🛠️ Let me try</button>
        <button className="btn sm sun" onClick={() => setShown("hint")}>💡 Give me a hint</button>
        <button className="btn sm sky" onClick={() => setShown("why")}>🔍 Explain why</button>
        <button className="btn sm ghost" disabled={busy} onClick={async () => { setBusy(true); await onFix(); setBusy(false); }}>🤖 Fix it for me</button>
      </div>
      {shown === "hint" && <div className="note">💡 {bug.hint}</div>}
      {shown === "why" && <div className="card flat tint-sky" style={{ padding: 12 }}>🔍 {bug.explanation} <span className="chip sky">{bug.concept}</span></div>}
    </div>
  );
}

export function ProjectStudio() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const nav = useNavigate();
  const { me } = useSession();
  const showRewards = useRewards();
  const { data, error, reload, setData } = useLoad(() => api.get<Detail>(`/kid/projects/${id}`), [id]);
  const [focus, setFocus] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>((location.state as { note?: string } | null)?.note ?? null);
  const tab = (params.get("tab") as Tab) || "play";
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });

  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  const p = data.project;
  const interactive = p.type === "game" || p.type === "app";
  const tabs: [Tab, string][] = interactive
    ? [["play", "▶ PLAY"], ["build", "🧩 BUILD"], ["explain", "💡 EXPLAIN"], ["code", "</> CODE"], ["test", "✅ TEST"], ["share", "👋 SHARE"], ["history", "🕰️ HISTORY"]]
    : [["play", "👀 VIEW"], ["build", "✏️ EDIT"], ["explain", "💡 EXPLAIN"], ["share", "👋 SHARE"], ["history", "🕰️ HISTORY"]];
  const refresh = async (rewards?: Rewards | null) => {
    showRewards(rewards);
    await reload();
  };
  const saveSpec = async (spec: unknown) => {
    setSaving(true);
    setActionError(null);
    try {
      const r = await api.put<{ project: Project; solved?: GameBug[]; rewards: Rewards }>(`/kid/projects/${p.id}/spec`, { spec });
      setFocus("");
      if (r.solved?.length) setNote(`🎉 You fixed it yourself: ${r.solved.map((s) => s.title.replace(/^🐛\s*/, "")).join(", ")}!`);
      await refresh(r.rewards);
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <div className="row">
          <span style={{ fontSize: "2.4rem" }}>{p.emoji}</span>
          <div>
            <h1 style={{ margin: 0 }}>{p.title}</h1>
            <span className="muted small" style={{ fontWeight: 800 }}>{TYPE_INFO[p.type].emoji} {TYPE_INFO[p.type].label} · version {p.version}{p.remixedFrom ? " · 🔄 remix" : ""}</span>
          </div>
        </div>
        {(p.type === "image" || p.type === "story") && data.permissions.gameCreation && (
          <Link className="btn sun sm" to={`/kid/build?idea=${encodeURIComponent(`A game about ${p.title}`)}&notes=${encodeURIComponent(p.idea)}`}>🎮 Turn it into a game</Link>
        )}
      </div>
      <div className="tabs" role="tablist">
        {tabs.map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>
      <Note>{note}</Note>
      {actionError && <div className="error">{actionError}</div>}

      {tab === "play" && <PlayTab p={p} onRewards={showRewards} onImprove={() => setTab("build")} />}
      {tab === "build" && (
        <BuildTab
          d={data}
          focus={focus}
          saving={saving}
          onSave={saveSpec}
          onChanged={async (r) => { await refresh(r); }}
          onFocus={setFocus}
          onReplace={(proj) => setData({ ...data, project: proj })}
        />
      )}
      {tab === "explain" && <ExplainTab d={data} age={me?.child?.age ?? 10} onDone={refresh} goCode={() => setTab("code")} />}
      {tab === "code" && <CodeTab p={p} onRewards={showRewards} />}
      {tab === "test" && <TestTab p={p} onRewards={showRewards} onFixed={refresh} onTry={(where) => { setFocus(focusSection(where) === "screens" ? where : focusSection(where)); setTab("build"); }} />}
      {tab === "share" && <ShareTab d={data} onDone={refresh} />}
      {tab === "history" && <HistoryTab d={data} onDone={refresh} onDeleted={() => nav("/kid/creations")} />}
    </div>
  );
}

function PlayTab({ p, onRewards, onImprove }: { p: Project; onRewards: (r: Rewards | null) => void; onImprove: () => void }) {
  const [ended, setEnded] = useState<string | null>(null);
  return (
    <div className="stack">
      <Viewer
        p={p}
        onStart={() => setEnded(null)}
        onEnd={async (r) => {
          setEnded(r.result);
          const out = await api.post<{ rewards: Rewards }>(`/kid/projects/${p.id}/played`, r).catch(() => null);
          onRewards(out?.rewards ?? null);
        }}
      />
      {(ended || p.type !== "game") && (
        <div className="card tint-violet center stack" style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
          <h3 style={{ margin: 0 }}>{ended === "won" ? "Too easy? 😎" : ended === "lost" ? "Too hard? 🤔" : "What should we improve?"}</h3>
          <p className="muted" style={{ margin: 0 }}>Every great creator tests, then improves.</p>
          <button className="btn" onClick={onImprove}>🧩 Improve it</button>
        </div>
      )}
    </div>
  );
}

interface ChangeResult {
  understood: boolean;
  summary?: string;
  explanation: string;
  concept?: string;
  newBugs?: GameCheck[];
  note?: string;
  project?: Project;
  rewards?: Rewards;
}

function BuildTab({ d, focus, saving, onSave, onChanged, onFocus, onReplace }: {
  d: Detail;
  focus: string;
  saving: boolean;
  onSave: (spec: unknown) => void;
  onChanged: (r: Rewards | null) => Promise<void>;
  onFocus: (f: string) => void;
  onReplace: (p: Project) => void;
}) {
  const p = d.project;
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ChangeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const examples: Record<string, string[]> = {
    game: ["Make it faster", "Add rocks", "Add 2 levels", "Add a 60 second timer", "Make it harder", "More lives", "Make it night"],
    app: ["Add search", "Add an about screen", "Ask for my name", "Make it blue", "Add an AI guide"],
    image: ["Add a rainbow", "Make it night time", "Add a friendly alien"],
    story: ["Make it funnier", "Add a dragon friend", "Make it shorter"],
  };
  const ask = async (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.post<ChangeResult>(`/kid/projects/${p.id}/ai-change`, { request: text });
      setResult(r);
      if (r.understood) {
        setRequest("");
        if (r.project) onReplace(r.project);
        await onChanged(r.rewards ?? null);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid two" style={{ alignItems: "start" }}>
      <div className="stack">
        <div className="card stack">
          <h3>🤖 Tell AI what to change</h3>
          <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); ask(request); }}>
            <input type="text" value={request} onChange={(e) => setRequest(e.target.value)} placeholder={examples[p.type][0]} maxLength={400} />
            <button className="btn" disabled={busy || request.trim().length < 2}>{busy ? "…" : "Go"}</button>
          </form>
          <div className="row" style={{ gap: 6 }}>
            {examples[p.type].map((e) => <button key={e} className="chip gray" onClick={() => ask(e)} disabled={busy}>{e}</button>)}
          </div>
          {busy && <div className="row"><span className="typing"><i /><i /><i /></span><span className="muted small">AI is changing your project…</span></div>}
          {error && <div className="error">{error}</div>}
          {result && !result.understood && <div className="note">🤔 {result.explanation}</div>}
          {result?.understood && (
            <div className="card flat tint-mint stack" style={{ padding: 14 }}>
              <b>✅ {result.summary}</b>
              <span>{result.explanation}</span>
              <div className="row" style={{ gap: 6 }}>
                {result.concept && <span className="chip sky">💡 {result.concept}</span>}
                <span className="chip gray">Saved as version {p.version}</span>
              </div>
              {result.note && <span className="small muted">{result.note}</span>}
            </div>
          )}
          {result?.newBugs?.map((c) => c.bug && (
            <BugCard
              key={c.id}
              bug={c.bug}
              onTry={() => onFocus(focusSection(c.bug!.where) === "screens" ? c.bug!.where : focusSection(c.bug!.where))}
              onFix={async () => {
                const r = await api.post<{ rewards: Rewards; project: Project }>(`/kid/projects/${p.id}/fix`, { bugId: c.bug!.id });
                setResult({ ...result, newBugs: result.newBugs?.filter((b) => b.id !== c.id) });
                onReplace(r.project);
                await onChanged(r.rewards);
              }}
            />
          ))}
        </div>
        {interactiveSide(p)}
      </div>
      <div>
        {p.type === "game" && <GameEditor spec={p.spec as GameSpec} onSave={onSave} focus={focus} saving={saving} />}
        {p.type === "app" && <AppEditor spec={p.spec as AppSpec} onSave={onSave} focus={focus} saving={saving} allowAiGuide={d.permissions.aiGuideInApps} />}
        {p.type === "image" && <SceneEditor spec={p.spec as SceneSpec} onSave={onSave} saving={saving} />}
        {p.type === "story" && <StoryEditor spec={p.spec as StorySpec} onSave={onSave} saving={saving} />}
      </div>
    </div>
  );
}

/** A live preview next to the editor so every change can be tested immediately. */
function interactiveSide(p: Project) {
  if (p.type !== "game" && p.type !== "app") return null;
  return (
    <div className="card stack">
      <h3>▶ Test it right here</h3>
      <Viewer p={p} />
    </div>
  );
}

function ExplainTab({ d, age, onDone, goCode }: { d: Detail; age: number; onDone: (r: Rewards | null) => Promise<void>; goCode: () => void }) {
  const p = d.project;
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<{ understood: boolean; feedback: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [learned, setLearned] = useState("");
  const [chat, setChat] = useState(false);
  const by = (k: string) => d.journal.filter((j) => j.kind === k);
  const list = (items: JournalEntry[], empty: string) =>
    items.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{items.map((j, i) => <li key={i} style={{ marginBottom: 4 }}>{j.text}</li>)}</ul> : <p className="muted small" style={{ margin: 0 }}>{empty}</p>;
  return (
    <div className="grid two" style={{ alignItems: "start" }}>
      <div className="stack">
        <div className="card tint-violet"><h3>💭 My idea</h3><p style={{ margin: 0 }}>{by("idea")[0]?.text ?? p.idea}</p></div>
        <div className="card"><h3>🤖 AI helped me with</h3>{list(by("ai"), "Nothing yet.")}</div>
        <div className="card"><h3>✏️ I changed</h3>{list(by("changed"), "Nothing yet — try BUILD mode!")}</div>
        <div className="card"><h3>🐛 Problems I solved</h3>{list(by("solved"), "No bugs fixed yet. Try the TEST tab!")}</div>
      </div>
      <div className="stack">
        <div className="card">
          <h3>💡 I learned</h3>
          {d.concepts.length > 0 && (
            <div className="stack" style={{ gap: 8, marginBottom: 10 }}>
              {d.concepts.map((c) => CONCEPTS[c] && (
                <div key={c} className="card flat" style={{ padding: 10 }}>
                  <b>{CONCEPTS[c].emoji} {c}</b>
                  <div className="small">{age <= 8 ? CONCEPTS[c].young : CONCEPTS[c].older}</div>
                </div>
              ))}
            </div>
          )}
          {list(by("learned"), "")}
          <form className="row" style={{ marginTop: 10, flexWrap: "nowrap" }} onSubmit={async (e) => {
            e.preventDefault();
            await api.post(`/kid/projects/${p.id}/journal`, { kind: "learned", text: learned });
            setLearned("");
            onDone(null);
          }}>
            <input type="text" value={learned} onChange={(e) => setLearned(e.target.value)} placeholder="Something I learned…" maxLength={300} />
            <button className="btn sm" disabled={learned.trim().length < 2}>Add</button>
          </form>
        </div>
        {(p.type === "game" || p.type === "app") && (
          <div className="card stack">
            <h3>🧠 Explain it in your own words</h3>
            <p className="small muted" style={{ margin: 0 }}>How does your {p.type} work? What happens when…? Real engineers explain their code to others.</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="When the rover touches a crystal, the score…" maxLength={1500} />
            <button className="btn" disabled={busy || text.trim().length < 3} onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                const r = await api.post<{ understood: boolean; feedback: string; rewards: Rewards }>(`/kid/projects/${p.id}/explain`, { text });
                setFeedback(r);
                await onDone(r.rewards);
              } catch (e) {
                setErr(errorText(e));
              } finally {
                setBusy(false);
              }
            }}>{busy ? "Reading…" : "Check my explanation"}</button>
            {err && <div className="error">{err}</div>}
            {feedback && <div className={feedback.understood ? "card flat tint-mint" : "note"} style={{ padding: 12 }}>{feedback.feedback}</div>}
            <button className="linkbtn" style={{ textAlign: "left" }} onClick={goCode}>{"</>"} See my code →</button>
          </div>
        )}
        <div className="card stack">
          <button className="linkbtn" style={{ textAlign: "left" }} onClick={() => setChat(!chat)}>💬 {chat ? "Hide" : "Ask Spark how my project works"}</button>
          {chat && <ChatPanel thread={`project:${p.id}`} placeholder="How does the score work?" />}
        </div>
      </div>
    </div>
  );
}

function CodeTab({ p, onRewards }: { p: Project; onRewards: (r: Rewards | null) => void }) {
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    api.post<{ rewards: Rewards }>(`/kid/projects/${p.id}/code-viewed`).then((r) => onRewards(r.rewards)).catch(() => {});
  }, [p.id, onRewards]);
  const code = p.type === "game" ? gameCode(p.spec as GameSpec) : appCode(p.spec as AppSpec);
  return (
    <div className="stack">
      <div className="card tint-sky">
        <h3>{"</>"} My Code</h3>
        <p style={{ margin: 0 }}>This is your {p.type} written as code. Every line matches something you can change in BUILD mode. Change a number there, and watch it change here!</p>
      </div>
      <CodeBlock code={code} />
      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>🗂️ See the raw data (JSON) the SparkForge engine reads</summary>
        <div className="code" style={{ marginTop: 10, maxHeight: 400, overflow: "auto" }}>{JSON.stringify(p.spec, null, 2)}</div>
      </details>
    </div>
  );
}

function TestTab({ p, onRewards, onFixed, onTry }: { p: Project; onRewards: (r: Rewards | null) => void; onFixed: (r: Rewards | null) => Promise<void>; onTry: (where: string) => void }) {
  const [checks, setChecks] = useState<GameCheck[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const r = await api.post<{ checks: GameCheck[]; rewards: Rewards }>(`/kid/projects/${p.id}/test`);
    setChecks(r.checks);
    onRewards(r.rewards);
    setBusy(false);
  };
  const failing = checks?.filter((c) => !c.passed) ?? [];
  return (
    <div className="narrow stack">
      <div className="card stack">
        <h3>✅ Test my {p.type}</h3>
        <p className="muted" style={{ margin: 0 }}>Tests ask simple questions about your {p.type}. Engineers run tests after every change.</p>
        <button className="btn big" onClick={run} disabled={busy}>{busy ? "Testing…" : checks ? "↻ Run tests again" : "▶ Run tests"}</button>
      </div>
      {checks && (
        <div className="card stack">
          {checks.map((c) => (
            <div key={c.id} className="check" style={{ background: c.passed ? "var(--mint-soft)" : "var(--coral-soft)" }}>
              <span>{c.passed ? "✅" : "❌"}</span> {c.question}
            </div>
          ))}
          <b>{failing.length ? `${failing.length} problem${failing.length > 1 ? "s" : ""} found.` : "🎉 All tests pass!"}</b>
        </div>
      )}
      {failing.map((c) => c.bug && (
        <BugCard
          key={c.id + p.version}
          bug={c.bug}
          onTry={() => onTry(c.bug!.where)}
          onFix={async () => {
            const r = await api.post<{ rewards: Rewards }>(`/kid/projects/${p.id}/fix`, { bugId: c.bug!.id });
            await onFixed(r.rewards);
            await run();
          }}
        />
      ))}
    </div>
  );
}

function ShareTab({ d, onDone }: { d: Detail; onDone: (r: Rewards | null) => Promise<void> }) {
  const p = d.project;
  const perms = d.permissions;
  const [remix, setRemix] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const { data: contacts } = useLoad(() => api.get<{ id: string; name: string }[]>("/kid/contacts"));
  const options = [
    { audience: "family", emoji: "👪", title: "Family", about: "A private link for your family.", ok: perms.projectSharing },
    { audience: "friends", emoji: "🧑‍🤝‍🧑", title: "Friends", about: "A private link friends can open and play.", ok: perms.friendSharing },
    { audience: "public", emoji: "🌍", title: "Publish", about: "A public project page.", ok: perms.publicPublishing },
  ];
  const share = async (audience: string) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api.post<{ pending: boolean; rewards: Rewards | null }>(`/kid/projects/${p.id}/share`, { audience, allowRemix: remix });
      setMsg(r.pending ? "📨 Sent to a grown-up for approval. Your link will work once they say yes!" : "🎉 Your link is ready!");
      await onDone(r.rewards);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const link = (s: Detail["shares"][number]) => `${location.origin}${s.slug ? `/p/${s.slug}` : `/s/${s.token}`}`;
  const active = d.shares.find((s) => s.status === "active");
  return (
    <div className="narrow stack">
      <div className="card stack">
        <h3>👋 Look what I made!</h3>
        <p className="muted" style={{ margin: 0 }}>Share pages show your first name only (if your grown-up allows it) — never where you live or go to school.</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {options.map((o) => (
            <button key={o.audience} className={`tile ${o.ok ? "" : "locked"}`} style={{ textAlign: "left", cursor: o.ok ? "pointer" : "not-allowed" }} disabled={!o.ok || busy} onClick={() => share(o.audience)}>
              <span className="ic">{o.emoji}</span><b>{o.title}</b><span>{o.ok ? o.about : "🔒 Ask a parent"}</span>
            </button>
          ))}
        </div>
        {perms.friendRemix && (
          <label className="toggle"><input type="checkbox" checked={remix} onChange={(e) => setRemix(e.target.checked)} /><span><b>Let friends remix it</b><br /><span className="small muted">They get their own copy to change. Yours stays the same.</span></span></label>
        )}
        {msg && <div className="note">{msg}</div>}
        {err && <div className="error">{err}</div>}
      </div>
      {d.shares.length > 0 && (
        <div className="card stack">
          <h3>🔗 My links</h3>
          {d.shares.map((s) => (
            <div key={s.token} className="card flat stack" style={{ padding: 12, gap: 6 }}>
              <div className="row between">
                <b>{s.audience === "public" ? "🌍 Public" : s.audience === "friends" ? "🧑‍🤝‍🧑 Friends" : "👪 Family"}{s.allowRemix ? " · remix on" : ""}</b>
                <span className={`chip ${s.status === "active" ? "mint" : "sun"}`}>{s.status === "active" ? "Live" : "Waiting for approval"}</span>
              </div>
              {s.status === "active" && (
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <input type="text" readOnly value={link(s)} onFocus={(e) => e.target.select()} />
                  <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(link(s)); setCopied(s.token); }}>{copied === s.token ? "Copied!" : "Copy"}</button>
                </div>
              )}
              <span className="small muted">👀 {s.views} views · ▶ {s.plays} plays · {timeAgo(s.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
      {perms.emailSharing && active && (contacts?.length ?? 0) > 0 && (
        <div className="card stack">
          <h3>✉️ Send it to…</h3>
          <div className="row">
            {contacts!.map((c) => (
              <button key={c.id} className="btn ghost" onClick={async () => {
                try {
                  await api.post(`/kid/projects/${p.id}/send`, { contactId: c.id, token: active.token });
                  setMsg(`📬 Sent to ${c.name}!`);
                } catch (e) {
                  setErr(errorText(e));
                }
              }}>Share with {c.name}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryTab({ d, onDone, onDeleted }: { d: Detail; onDone: (r: Rewards | null) => Promise<void>; onDeleted: () => void }) {
  const p = d.project;
  const [preview, setPreview] = useState<{ version: number; spec: unknown } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const authors = { ai: "🤖 AI", child: "🧒 Me", fix: "🐛 Fix" };
  return (
    <div className="narrow stack">
      <div className="card tint-sky"><p style={{ margin: 0 }}>🕰️ Every change is saved as a version. Engineers call this <b>version control</b> — so you can experiment without fear!</p></div>
      <div className="card stack">
        {d.versions.map((v) => (
          <div key={v.version} className="row between" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
            <span>
              <b>v{v.version}</b> {v.summary} <br />
              <span className="small muted">{authors[v.author]} · {timeAgo(v.createdAt)}</span>
            </span>
            <div className="row">
              <button className="btn ghost sm" onClick={async () => setPreview({ version: v.version, spec: (await api.get<{ spec: unknown }>(`/kid/projects/${p.id}/versions/${v.version}`)).spec })}>👀 Look</button>
              {v.version !== p.version && (
                <button className="btn sm" onClick={async () => {
                  try {
                    const r = await api.post<{ rewards: Rewards }>(`/kid/projects/${p.id}/restore`, { version: v.version });
                    await onDone(r.rewards);
                  } catch (e) {
                    setErr(errorText(e));
                  }
                }}>↩ Go back</button>
              )}
            </div>
          </div>
        ))}
        {err && <div className="error">{err}</div>}
      </div>
      <button className="btn danger" onClick={async () => { if (confirm(`Delete “${p.title}”? This can't be undone.`)) { await api.del(`/kid/projects/${p.id}`); onDeleted(); } }}>🗑️ Delete this project</button>
      {preview && (
        <Modal onClose={() => setPreview(null)}>
          <div className="row between"><h3>Version {preview.version}</h3><button className="btn ghost sm" onClick={() => setPreview(null)}>Close</button></div>
          <Viewer p={{ ...p, spec: preview.spec as Project["spec"], version: preview.version }} />
        </Modal>
      )}
    </div>
  );
}
