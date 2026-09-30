import { useRef, useState } from "react";
import { api, errorText } from "../api";
import type { Rewards } from "../components/rewards";
import { useRewards } from "../components/rewards";
import { useLoad } from "../components/ui";
import { useSession } from "../session";
import { CodeEditor, CodeRunner, type RunError } from "../game/CodeMode";
import type { CodeSpec } from "../../../shared/creations";
import type { GameCheck } from "../../../shared/game";
import type { Project } from "../../../shared/types";
import type { Detail } from "./Project";

// ---------- Code Mode: edit + run + AI help ----------

export function CodeBuildTab({ d, saving, onSave, onChanged, onReplace }: {
  d: Detail;
  saving: boolean;
  onSave: (spec: unknown) => Promise<void> | void;
  onChanged: (r: Rewards | null) => Promise<void>;
  onReplace: (p: Project) => void;
}) {
  const p = d.project;
  const spec = p.spec as CodeSpec;
  const showRewards = useRewards();
  const [runId, setRunId] = useState(0);
  const [error, setError] = useState<RunError | null>(null);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ ok: boolean; text: string } | null>(null);
  const lastRun = useRef("");

  const onRan = (ok: boolean, err?: RunError) => {
    setError(ok ? null : err ?? null);
    // Report each version's first run once (for the Real Coder medal and debugging stats).
    const key = `${p.version}-${ok}`;
    if (lastRun.current === key) return;
    lastRun.current = key;
    api.post<{ rewards: Rewards }>(`/kid/projects/${p.id}/ran`, { ok, error: err?.message ?? "" }).then((r) => showRewards(r.rewards)).catch(() => {});
  };

  const help = async (request: string) => {
    setBusy(true);
    setAnswer(null);
    try {
      const r = await api.post<{ understood: boolean; summary?: string; explanation: string; project?: Project; rewards?: Rewards }>(`/kid/projects/${p.id}/ai-change`, {
        request: request || "Help me fix this error",
        ...(error ? { error: `${error.line ? `Line ${error.line}: ` : ""}${error.message}` } : {}),
      });
      setAnswer({ ok: r.understood, text: r.understood ? `✅ ${r.summary} — ${r.explanation}` : `💡 ${r.explanation}` });
      if (r.understood && r.project) {
        onReplace(r.project);
        setRunId((n) => n + 1);
        await onChanged(r.rewards ?? null);
      }
      setAsk("");
    } catch (e) {
      setAnswer({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid two" style={{ alignItems: "start" }}>
      <div className="stack">
        <CodeEditor spec={spec} saving={saving} errorLine={error?.line} onSave={async (s) => { await onSave(s); setRunId((n) => n + 1); }} />
        <div className="card stack">
          <h3>🤖 Ask AI about my code</h3>
          <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); help(ask); }}>
            <input type="text" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Make stars worth double points" maxLength={400} />
            <button className="btn" disabled={busy || (ask.trim().length < 2 && !error)}>{busy ? "…" : "Ask"}</button>
          </form>
          {error && <button className="btn sun sm" disabled={busy} onClick={() => help("")}>🐛 Help me with this error</button>}
          {answer && <div className={answer.ok ? "card flat tint-mint" : "note"} style={{ padding: 12 }}>{answer.text}</div>}
          <p className="small muted" style={{ margin: 0 }}>Your AI help level decides whether AI rewrites code or gives hints.</p>
        </div>
      </div>
      <div className="card stack">
        <h3>▶ Run</h3>
        <CodeRunner spec={spec} runId={runId} onRan={onRan} />
      </div>
    </div>
  );
}

// ---------- AI agent ----------

interface Step { title: string; request: string; why: string; state?: "doing" | "done" | "skipped"; detail?: string }

export function AgentPanel({ p, onChanged, onReplace }: { p: Project; onChanged: (r: Rewards | null) => Promise<void>; onReplace: (p: Project) => void }) {
  const [goal, setGoal] = useState("");
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const stop = useRef(false);
  const plan = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ plan: { steps: Step[] } }>(`/kid/projects/${p.id}/agent/plan`, { goal });
      setSteps(r.plan.steps);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const runAll = async () => {
    if (!steps) return;
    setBusy(true);
    stop.current = false;
    const out = [...steps];
    for (let i = 0; i < out.length && !stop.current; i++) {
      out[i] = { ...out[i], state: "doing" };
      setSteps([...out]);
      try {
        const r = await api.post<{ understood: boolean; explanation: string; summary?: string; project?: Project; rewards?: Rewards; newBugs?: GameCheck[] }>(`/kid/projects/${p.id}/ai-change`, { request: out[i].request });
        out[i] = { ...out[i], state: r.understood ? "done" : "skipped", detail: r.understood ? `${r.summary}${r.newBugs?.length ? " — 🐛 a test failed, check the TEST tab" : ""}` : r.explanation };
        if (r.project) onReplace(r.project);
        if (r.understood) await onChanged(r.rewards ?? null);
      } catch (e) {
        out[i] = { ...out[i], state: "skipped", detail: errorText(e) };
      }
      setSteps([...out]);
    }
    setBusy(false);
  };
  return (
    <div className="card stack">
      <h3>🦾 AI Agent</h3>
      <p className="small muted" style={{ margin: 0 }}>Give a bigger goal. The agent makes a plan, you approve it, then it builds one step at a time — saving a version after each step.</p>
      {!steps ? (
        <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); plan(); }}>
          <input type="text" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Make it harder and add aliens" maxLength={300} />
          <button className="btn" disabled={busy || goal.trim().length < 3}>{busy ? "…" : "Plan"}</button>
        </form>
      ) : (
        <>
          <ol className="stack" style={{ gap: 8, paddingLeft: 20, margin: 0 }}>
            {steps.map((s, i) => (
              <li key={i}>
                <div className="row between" style={{ flexWrap: "nowrap" }}>
                  <span><b>{s.state === "done" ? "✅" : s.state === "doing" ? "⏳" : s.state === "skipped" ? "⏭️" : "⬜"} {s.title}</b><br /><span className="small muted">{s.detail ?? s.why}</span></span>
                  {!busy && !s.state && <button className="btn danger sm" onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label="Remove step">✕</button>}
                </div>
              </li>
            ))}
          </ol>
          <div className="row">
            {busy ? (
              <button className="btn ghost sm" onClick={() => { stop.current = true; }}>⏹ Stop after this step</button>
            ) : steps.some((s) => !s.state) ? (
              <>
                <button className="btn mint" onClick={runAll} disabled={!steps.length}>✅ Approve & build</button>
                <button className="btn ghost sm" onClick={() => setSteps(null)}>Change goal</button>
              </>
            ) : (
              <button className="btn ghost sm" onClick={() => { setSteps(null); setGoal(""); }}>New goal</button>
            )}
          </div>
        </>
      )}
      {err && <div className="error">{err}</div>}
    </div>
  );
}

// ---------- Sharing extras: download, GitHub, friends, reactions ----------

interface Friends {
  enabled: boolean;
  friends: { id: string; name: string; avatar: string }[];
  presets: string[];
}

export function ShareExtras({ d, onDone }: { d: Detail; onDone: (r: Rewards | null) => Promise<void> }) {
  const p = d.project;
  const perms = d.permissions;
  const exportable = p.type === "game" || p.type === "app" || p.type === "code";
  const { data: friends } = useLoad(() => api.get<Friends>("/kid/friends"));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deployed, setDeployed] = useState<{ repoUrl: string; pagesUrl: string | null; commit: string } | null>(null);
  const [note, setNote] = useState("Look what I made!");
  const deploy = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ repoUrl: string; pagesUrl: string | null; commit: string; rewards: Rewards }>(`/kid/projects/${p.id}/deploy`);
      setDeployed(r);
      await onDone(r.rewards);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const dep = deployed ?? d.deployment;
  return (
    <>
      {perms.friends && perms.friendSharing && friends?.enabled && (
        <div className="card stack">
          <h3>📬 Send to a friend</h3>
          {friends.friends.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>No SparkForge friends yet. A grown-up can connect you with a friend code.</p>
          ) : (
            <>
              <select value={note} onChange={(e) => setNote(e.target.value)} aria-label="Message">
                {["Look what I made!", ...friends.presets].map((x) => <option key={x}>{x}</option>)}
              </select>
              <div className="row">
                {friends.friends.map((f) => (
                  <button key={f.id} className="btn ghost" disabled={busy} onClick={async () => {
                    setErr(null);
                    try {
                      const r = await api.post<{ pending: boolean; to: string; rewards: Rewards | null }>(`/kid/projects/${p.id}/send-friend`, { friendId: f.id, note });
                      setMsg(r.pending ? `📨 Waiting for a grown-up to approve, then ${r.to} will get it.` : `📬 Sent to ${r.to}!`);
                      await onDone(r.rewards);
                    } catch (e) {
                      setErr(errorText(e));
                    }
                  }}>{f.avatar} {f.name}</button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {d.reactions.length > 0 && (
        <div className="card stack">
          <h3>💬 What friends said</h3>
          <div className="row" style={{ gap: 6 }}>
            {d.reactions.map((r) => <span key={r.kind + r.value} className={`chip ${r.kind === "emoji" ? "sun" : "sky"}`}>{r.value}{r.n > 1 ? ` ×${r.n}` : ""}</span>)}
          </div>
        </div>
      )}
      {exportable && (
        <div className="card stack">
          <h3>⬇️ Take it anywhere</h3>
          <p className="small muted" style={{ margin: 0 }}>Download your {p.type} as a single web page. It works in any browser — even offline.</p>
          <a className="btn ghost" href={`/api/kid/projects/${p.id}/export`} download>⬇️ Download as a web page</a>
        </div>
      )}
      {exportable && perms.github && (
        <div className="card stack">
          <h3>🐙 GitHub</h3>
          {!d.githubReady ? (
            <p className="muted small" style={{ margin: 0 }}>Ask a grown-up to connect GitHub in the parent area.</p>
          ) : (
            <>
              <p className="small" style={{ margin: 0 }}>
                Real engineers keep code in a <b>repository</b>. Each save is a <b>commit</b>.{" "}
                {perms.publicPublishing ? <>Then it's <b>deployed</b> to the web with GitHub Pages.</> : "Your repository stays private."}
              </p>
              <button className="btn" disabled={busy} onClick={deploy}>{busy ? "Working…" : dep ? `🔄 Update to version ${p.version}` : perms.publicPublishing ? "🚀 Save to GitHub & put it on the web" : "🐙 Save to GitHub"}</button>
              {dep && (
                <div className="card flat tint-mint stack" style={{ padding: 12, gap: 6 }}>
                  {deployed && <span className="small">✅ Committed: <code>{deployed.commit}</code></span>}
                  <a href={dep.repoUrl} target="_blank" rel="noreferrer">📁 Repository</a>
                  {dep.pagesUrl && <a href={dep.pagesUrl} target="_blank" rel="noreferrer">🌍 Live site (can take a minute to appear)</a>}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {msg && <div className="note">{msg}</div>}
      {err && <div className="error">{err}</div>}
    </>
  );
}

// ---------- Building together ----------

export function TeamTab({ d, onDone }: { d: Detail; onDone: (r: Rewards | null) => Promise<void> }) {
  const p = d.project;
  const owner = d.role === "owner";
  const { me } = useSession();
  const { data: friends } = useLoad(() => api.get<Friends>("/kid/friends"));
  const [friendId, setFriendId] = useState("");
  const [role, setRole] = useState("Character Designer");
  const [task, setTask] = useState("");
  const [assignee, setAssignee] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const call = async (fn: () => Promise<{ rewards?: Rewards | null } | unknown>) => {
    setErr(null);
    try {
      const r = (await fn()) as { rewards?: Rewards | null };
      await onDone(r?.rewards ?? null);
    } catch (e) {
      setErr(errorText(e));
    }
  };
  const team = [{ id: p.childId, name: owner ? "Me" : d.owner ?? "Owner", avatar: "👑", role: "Owner" }, ...d.collaborators];
  const nameOf = (id: string | null) => (id === "ai" ? "🤖 AI" : id ? team.find((t) => t.id === id)?.name ?? "?" : "Anyone");
  const invitable = (friends?.friends ?? []).filter((f) => !d.collaborators.some((c) => c.id === f.id));
  return (
    <div className="grid two" style={{ alignItems: "start" }}>
      <div className="card stack">
        <h3>👥 Team</h3>
        <p className="small muted" style={{ margin: 0 }}>Build together! Every change is saved with the name of who made it.</p>
        {team.map((t) => (
          <div key={t.id} className="row between">
            <span>{t.avatar} <b>{t.name}</b> <span className="chip gray">{t.role}</span></span>
            {t.role !== "Owner" && (owner || t.id === me?.child?.id) && (
              <button className="btn danger sm" onClick={() => call(() => api.del(`/kid/projects/${p.id}/collaborators/${t.id}`))}>{owner ? "Remove" : "Leave"}</button>
            )}
          </div>
        ))}
        {owner && d.permissions.collaboration && (
          invitable.length ? (
            <form className="stack" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (friendId) call(() => api.post(`/kid/projects/${p.id}/collaborators`, { friendId, role })); }}>
              <select value={friendId} onChange={(e) => setFriendId(e.target.value)} aria-label="Friend">
                <option value="">Invite a friend…</option>
                {invitable.map((f) => <option key={f.id} value={f.id}>{f.avatar} {f.name}</option>)}
              </select>
              <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Their job, e.g. Level Designer" maxLength={40} />
              <button className="btn sm" disabled={!friendId}>🤝 Invite</button>
            </form>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>{friends?.friends.length ? "All your friends are on the team!" : "Add friends (with a grown-up's friend code) to build together."}</p>
          )
        )}
      </div>
      <div className="card stack">
        <h3>📝 Tasks</h3>
        {d.tasks.length === 0 && <p className="small muted" style={{ margin: 0 }}>Split the work: who does what?</p>}
        {d.tasks.map((t) => (
          <label key={t.id} className="toggle" style={{ alignItems: "center" }}>
            <input type="checkbox" checked={t.done} onChange={(e) => call(() => api.patch(`/kid/projects/${p.id}/tasks/${t.id}`, { done: e.target.checked }))} />
            <span style={{ flex: 1, textDecoration: t.done ? "line-through" : "none" }}><b>{t.text}</b><br /><span className="small muted">{nameOf(t.assignee)}</span></span>
            <button type="button" className="linkbtn small" onClick={(e) => { e.preventDefault(); call(() => api.del(`/kid/projects/${p.id}/tasks/${t.id}`)); }}>✕</button>
          </label>
        ))}
        <form className="stack" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); call(() => api.post(`/kid/projects/${p.id}/tasks`, { text: task, assignee: assignee || null })); setTask(""); }}>
          <input type="text" value={task} onChange={(e) => setTask(e.target.value)} placeholder="Design the aliens" maxLength={120} />
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Who">
            <option value="">Anyone</option>
            {team.map((t) => <option key={t.id} value={t.id}>{t.avatar} {t.name}</option>)}
            <option value="ai">🤖 AI (coding assistant)</option>
          </select>
          <button className="btn sm" disabled={task.trim().length < 2}>+ Add task</button>
        </form>
        {err && <div className="error">{err}</div>}
      </div>
    </div>
  );
}
