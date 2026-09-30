import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useSession } from "../session";
import { ErrorBox, Loading, timeAgo, TYPE_INFO, useLoad } from "../components/ui";
import { CREATOR_LEVELS, PERMISSION_INFO, type ChildProfile, type Permissions } from "../../../shared/types";

interface DashChild extends ChildProfile {
  level: string;
  projectCount: number;
  recentProjects: { id: string; type: string; title: string; emoji: string; version: number; updated_at: string }[];
  topics: string[];
  newSkills: string[];
  medals: { id: string; emoji: string; title: string; earnedAt: string }[];
  safety: "ok" | "review" | "attention";
  friends: { id: string; name: string; avatar: string }[];
  aiToday: number;
  activity14d: number;
}
interface Dash {
  children: DashChild[];
  alerts: { id: string; childName: string; severity: string; category: string; summary: string; excerpt: string; reviewed: boolean; createdAt: string }[];
  shares: { token: string; childName: string; title: string; emoji: string; audience: string; status: string; allowRemix: boolean; views: number; plays: number; createdAt: string }[];
  contacts: { id: string; name: string; email: string }[];
  outbox: { id: string; childName: string; to: string; subject: string; body: string; status: string; createdAt: string }[];
  ai: { provider: string; live: boolean };
}

const AVATARS = ["🧒", "👧", "👦", "🧑‍🚀", "🦊", "🐱", "🐼", "🦄", "🤖", "🐉", "🦁", "🐧"];
const INTERESTS = ["Space", "Animals", "Games", "Art", "Dinosaurs", "Ocean", "Robots", "Music", "Sports", "Science", "Stories", "Volcanoes"];

function AddChild({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ name: "", age: 9, avatar: "🧒", experience: "beginner", interests: [] as string[] });
  const [error, setError] = useState<unknown>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/parent/children", f);
      setF({ name: "", age: 9, avatar: "🧒", experience: "beginner", interests: [] });
      onDone();
    } catch (err) {
      setError(err);
    }
  };
  return (
    <form className="card stack" onSubmit={submit}>
      <h3>➕ Add a child</h3>
      <div className="grid two">
        <label className="field">First name (or nickname)<input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={40} /></label>
        <label className="field">Age: {f.age}<input type="range" min={4} max={18} value={f.age} onChange={(e) => setF({ ...f, age: Number(e.target.value) })} /></label>
      </div>
      <div className="field">Avatar
        <div className="row" style={{ gap: 6 }}>
          {AVATARS.map((a) => <button type="button" key={a} className={`chip ${f.avatar === a ? "selected" : "gray"}`} style={{ fontSize: "1.2rem" }} onClick={() => setF({ ...f, avatar: a })}>{a}</button>)}
        </div>
      </div>
      <label className="field">Experience
        <select value={f.experience} onChange={(e) => setF({ ...f, experience: e.target.value })}>
          <option value="beginner">Beginner</option><option value="some">Some experience</option><option value="experienced">Experienced</option>
        </select>
      </label>
      <div className="field">Interests
        <div className="row" style={{ gap: 6 }}>
          {INTERESTS.map((i) => (
            <button type="button" key={i} className={`chip ${f.interests.includes(i) ? "selected" : "gray"}`} onClick={() => setF({ ...f, interests: f.interests.includes(i) ? f.interests.filter((x) => x !== i) : [...f.interests, i] })}>{i}</button>
          ))}
        </div>
      </div>
      <p className="small muted">Age changes how SparkForge explains things and sets safer defaults for younger kids — it never blocks a child from trying advanced projects. You can fine-tune permissions next.</p>
      <ErrorBox error={error} />
      <button className="btn">Add child</button>
    </form>
  );
}

export function ParentDashboard() {
  const { refresh } = useSession();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { data, error, loading, reload } = useLoad(() => api.get<Dash>("/parent/dashboard"));
  const [contact, setContact] = useState({ name: "", email: "" });
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} />;
  const enter = async (id: string) => {
    await api.post(`/parent/children/${id}/enter`);
    await refresh();
    nav("/kid");
  };
  const pending = data.shares.filter((s) => s.status === "pending");
  const openAlerts = data.alerts.filter((a) => !a.reviewed);
  return (
    <div className="stack" style={{ gap: 20 }}>
      {params.get("welcome") && !data.children.length && (
        <div className="card tint-violet"><h2>Welcome to SparkForge! 👋</h2><p>Start by adding your child. Then hand them the device with “Start creating”.</p></div>
      )}
      {!data.ai.live && (
        <div className="note">🧪 No AI model is connected, so SparkForge is using its built-in practice helper (a few topics, simple changes). Set <code>ANTHROPIC_API_KEY</code> on the server to enable live AI.</div>
      )}
      {data.children.map((c) => {
        const lvl = CREATOR_LEVELS.find((l) => l.id === c.level);
        return (
          <div key={c.id} className="card stack">
            <div className="row between">
              <div className="row">
                <span className="avatar lg">{c.avatar}</span>
                <div>
                  <h2 style={{ margin: 0 }}>{c.name}</h2>
                  <span className="muted small" style={{ fontWeight: 800 }}>Age {c.age} · {lvl?.emoji} {lvl?.label}</span>
                </div>
              </div>
              <div className="row">
                <span className={`chip ${c.safety === "ok" ? "mint" : c.safety === "review" ? "sun" : "coral"}`}>
                  {c.safety === "ok" ? "🟢 No safety issues" : c.safety === "review" ? "🟡 Items to review" : "🔴 Needs attention"}
                </span>
                <Link to={`/parent/child/${c.id}`} className="btn ghost sm">⚙️ Settings</Link>
                <button className="btn sm" onClick={() => enter(c.id)}>▶ Start creating as {c.name}</button>
              </div>
            </div>
            <div className="grid small">
              <div className="card flat center"><h2 style={{ margin: 0 }}>{c.projectCount}</h2><span className="muted small">projects</span></div>
              <div className="card flat center"><h2 style={{ margin: 0 }}>{c.medals.length}</h2><span className="muted small">medals</span></div>
              <div className="card flat center"><h2 style={{ margin: 0 }}>{c.activity14d}</h2><span className="muted small">activities (14 days)</span></div>
              <div className="card flat center"><h2 style={{ margin: 0 }}>{c.aiToday}<span className="muted small">/{c.permissions.dailyAiLimit}</span></h2><span className="muted small">AI requests today</span></div>
            </div>
            <div className="grid two">
              <div>
                <h4>Recent creations</h4>
                {c.recentProjects.length ? c.recentProjects.map((p) => (
                  <div key={p.id} className="row" style={{ padding: "4px 0" }}>
                    <span>{p.emoji}</span><b>{p.title}</b><span className="chip gray">{TYPE_INFO[p.type]?.label} v{p.version}</span><span className="muted small">{timeAgo(p.updated_at)}</span>
                  </div>
                )) : <p className="muted small">Nothing yet.</p>}
              </div>
              <div className="stack" style={{ gap: 10 }}>
                <div><h4>Curious about</h4><div className="row" style={{ gap: 6 }}>{c.topics.length ? c.topics.map((t) => <span key={t} className="chip gray">{t}</span>) : <span className="muted small">—</span>}</div></div>
                <div><h4>Skills discovered</h4><div className="row" style={{ gap: 6 }}>{c.newSkills.length ? c.newSkills.map((t) => <span key={t} className="chip sky">{t}</span>) : <span className="muted small">—</span>}</div></div>
                <div><h4>Friends</h4><div className="row" style={{ gap: 6 }}>{c.friends.length ? c.friends.map((f) => <span key={f.id} className="chip gray">{f.avatar} {f.name}</span>) : <span className="muted small">— add friends in ⚙️ Settings</span>}</div></div>
                <div><h4>Medals</h4><div className="row" style={{ gap: 6 }}>{c.medals.length ? c.medals.slice(0, 8).map((m) => <span key={m.id} className="chip sun" title={m.title}>{m.emoji} {m.title}</span>) : <span className="muted small">—</span>}</div></div>
              </div>
            </div>
          </div>
        );
      })}

      {pending.length > 0 && (
        <div className="card stack">
          <h3>✅ Shares waiting for your approval</h3>
          {pending.map((s) => (
            <div key={s.token} className="row between">
              <span><b>{s.childName}</b> wants to share {s.emoji} <b>{s.title}</b> with <b>{s.audience}</b></span>
              <div className="row">
                <a className="btn ghost sm" href={`/s/${s.token}?preview=1`} target="_blank" rel="noreferrer">Preview</a>
                <button className="btn mint sm" onClick={async () => { await api.post(`/parent/shares/${s.token}/approve`); reload(); }}>Approve</button>
                <button className="btn danger sm" onClick={async () => { await api.post(`/parent/shares/${s.token}/revoke`); reload(); }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card stack">
        <h3>🛡️ Safety {openAlerts.length ? <span className="chip coral">{openAlerts.length} to review</span> : <span className="chip mint">All clear</span>}</h3>
        <p className="small muted">You see short alerts when something matters — not every conversation.</p>
        {data.alerts.length === 0 && <p className="muted">No safety events. 🎉</p>}
        {data.alerts.slice(0, 15).map((a) => (
          <div key={a.id} className="card flat" style={{ padding: 12, opacity: a.reviewed ? 0.55 : 1 }}>
            <div className="row between">
              <span className="row"><span className={`badge-sev ${a.severity}`}>{a.severity}</span><b>{a.childName}</b><span className="muted small">{timeAgo(a.createdAt)}</span></span>
              {!a.reviewed && <button className="btn ghost sm" onClick={async () => { await api.post(`/parent/alerts/${a.id}/review`); reload(); }}>Mark reviewed</button>}
            </div>
            <p style={{ margin: "6px 0 0" }}>{a.summary}</p>
            {a.excerpt && <p className="small muted" style={{ margin: "4px 0 0" }}>“{a.excerpt}”</p>}
          </div>
        ))}
      </div>

      <div className="card stack">
        <h3>🔗 Shared links</h3>
        {data.shares.filter((s) => s.status === "active").length === 0 && <p className="muted small">No active links.</p>}
        {data.shares.filter((s) => s.status === "active").map((s) => (
          <div key={s.token} className="row between">
            <span>{s.emoji} <b>{s.title}</b> <span className="muted small">by {s.childName} · {s.audience}{s.allowRemix ? " · remix on" : ""} · 👀 {s.views} · ▶ {s.plays}</span></span>
            <div className="row">
              <a className="btn ghost sm" href={`/s/${s.token}`} target="_blank" rel="noreferrer">Open</a>
              <button className="btn danger sm" onClick={async () => { await api.post(`/parent/shares/${s.token}/revoke`); reload(); }}>Turn off</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card stack">
        <h3>🔌 Connectors</h3>
        <div className="card flat">
          <h4>✉️ Approved contacts</h4>
          <p className="small muted">Kids can send share links only to these people (when “Send to approved contacts” is on). Messages appear in the outbox below.</p>
          {data.contacts.map((c) => (
            <div key={c.id} className="row between" style={{ padding: "4px 0" }}>
              <span><b>{c.name}</b> <span className="muted small">{c.email}</span></span>
              <button className="btn danger sm" onClick={async () => { await api.del(`/parent/contacts/${c.id}`); reload(); }}>Remove</button>
            </div>
          ))}
          <form className="row" style={{ marginTop: 8 }} onSubmit={async (e) => { e.preventDefault(); await api.post("/parent/contacts", contact); setContact({ name: "", email: "" }); reload(); }}>
            <input type="text" placeholder="Name (e.g. Dad)" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} required style={{ flex: 1, minWidth: 140 }} />
            <input type="email" placeholder="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} required style={{ flex: 2, minWidth: 180 }} />
            <button className="btn sm">Add</button>
          </form>
          {data.outbox.length > 0 && (
            <>
              <h4 style={{ marginTop: 14 }}>Outbox</h4>
              <p className="small muted">Messages are emailed when the server has SMTP settings; otherwise they wait here for you to forward.</p>
              {data.outbox.map((o) => (
                <div key={o.id} className="small" style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>
                  <b>{o.childName} → {o.to}</b> <span className={`chip ${o.status === "sent" ? "mint" : o.status === "failed" ? "coral" : "gray"}`}>{o.status === "sent" ? "sent" : o.status === "failed" ? "failed" : "to forward"}</span> <span className="muted">{timeAgo(o.createdAt)}</span><br />{o.subject}<br /><span className="muted" style={{ whiteSpace: "pre-wrap" }}>{o.body}</span>
                </div>
              ))}
            </>
          )}
        </div>
        <GitHubConnector />
      </div>

      <AddChild onDone={reload} />
    </div>
  );
}

function GitHubConnector() {
  const { data, reload } = useLoad(() => api.get<{ github: { account: string; connectedAt: string } | null }>("/parent/connectors"));
  const [token, setToken] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="card flat stack">
      <h4>🐙 GitHub</h4>
      <p className="small muted" style={{ margin: 0 }}>
        Lets children save projects as repositories in <b>your</b> GitHub account, and (if public publishing is on) put them on the web with GitHub Pages.
        Create a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">fine-grained token</a> with
        “Administration”, “Contents” and “Pages” read &amp; write permissions. It's stored encrypted. Turn on “GitHub” per child in ⚙️ Settings.
      </p>
      {data?.github ? (
        <div className="row between">
          <span className="chip mint">Connected as @{data.github.account}</span>
          <button className="btn danger sm" onClick={async () => { await api.del("/parent/connectors/github"); reload(); }}>Disconnect</button>
        </div>
      ) : (
        <form className="row" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await api.post("/parent/connectors/github", { token });
            setToken("");
            reload();
          } catch (ex) {
            setErr(ex);
          } finally {
            setBusy(false);
          }
        }}>
          <input type="password" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} style={{ flex: 1, minWidth: 200 }} autoComplete="off" />
          <button className="btn sm" disabled={busy || token.length < 20}>{busy ? "Checking…" : "Connect"}</button>
        </form>
      )}
      <ErrorBox error={err} />
    </div>
  );
}

function FriendCodes({ childId, name, onChange }: { childId: string; name: string; onChange: () => void }) {
  const { data: friends, reload } = useLoad(() => api.get<{ id: string; name: string; avatar: string }[]>(`/parent/children/${childId}/friends`), [childId]);
  const [code, setCode] = useState<string | null>(null);
  const [enter, setEnter] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  return (
    <div className="card stack">
      <h3>🤝 {name}'s friends</h3>
      <p className="small muted" style={{ margin: 0 }}>
        Friends are connected by parents only. Make a code and give it to the other child's parent (in person or by message) — or enter the code they gave you.
        Codes work once, for 7 days. Children never see each other's family details.
      </p>
      {friends?.map((f) => (
        <div key={f.id} className="row between">
          <span>{f.avatar} <b>{f.name}</b></span>
          <button className="btn danger sm" onClick={async () => { await api.del(`/parent/children/${childId}/friends/${f.id}`); reload(); onChange(); }}>Remove</button>
        </div>
      ))}
      <div className="row">
        <button className="btn ghost sm" onClick={async () => {
          setErr(null);
          try {
            setCode((await api.post<{ code: string }>(`/parent/children/${childId}/friend-code`)).code);
          } catch (e) {
            setErr(e);
          }
        }}>Make a friend code</button>
        {code && <span className="chip sun" style={{ fontSize: "1rem", userSelect: "all" }}>{code}</span>}
      </div>
      <form className="row" onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        try {
          const r = await api.post<{ friend: { name: string } }>(`/parent/children/${childId}/friend-code/redeem`, { code: enter });
          setMsg(`🎉 ${name} and ${r.friend.name} are now friends.`);
          setEnter("");
          reload();
          onChange();
        } catch (ex) {
          setErr(ex);
        }
      }}>
        <input type="text" placeholder="Enter a friend code, e.g. STAR-1234-56" value={enter} onChange={(e) => setEnter(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn sm" disabled={enter.length < 6}>Add friend</button>
      </form>
      {msg && <div className="note">{msg}</div>}
      <ErrorBox error={err} />
    </div>
  );
}

export function ChildSettings() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, error, loading } = useLoad(async () => (await api.get<Dash>("/parent/dashboard")).children.find((c) => c.id === id) ?? null, [id]);
  const [draft, setDraft] = useState<DashChild | null>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox error={error ?? "Child not found"} />;
  const c = draft ?? data;
  const setPerm = (k: keyof Permissions, v: unknown) => { setSaved(false); setDraft({ ...c, permissions: { ...c.permissions, [k]: v } }); };
  const groups = [...new Set(PERMISSION_INFO.map((p) => p.group))];
  const save = async () => {
    try {
      await api.patch(`/parent/children/${c.id}`, { name: c.name, age: c.age, avatar: c.avatar, experience: c.experience, interests: c.interests, permissions: c.permissions });
      setSaved(true);
      setSaveError(null);
    } catch (e) {
      setSaveError(e);
    }
  };
  return (
    <div className="stack narrow" style={{ gap: 16 }}>
      <Link to="/parent">← Dashboard</Link>
      <div className="card stack">
        <div className="row"><span className="avatar lg">{c.avatar}</span><h2 style={{ margin: 0 }}>{c.name}'s settings</h2></div>
        <div className="grid two">
          <label className="field">Name<input type="text" value={c.name} onChange={(e) => setDraft({ ...c, name: e.target.value })} /></label>
          <label className="field">Age: {c.age}<input type="range" min={4} max={18} value={c.age} onChange={(e) => setDraft({ ...c, age: Number(e.target.value) })} /></label>
          <label className="field">Experience
            <select value={c.experience} onChange={(e) => setDraft({ ...c, experience: e.target.value as ChildProfile["experience"] })}>
              <option value="beginner">Beginner</option><option value="some">Some experience</option><option value="experienced">Experienced</option>
            </select>
          </label>
          <label className="field">Interests (comma separated)<input type="text" value={c.interests.join(", ")} onChange={(e) => setDraft({ ...c, interests: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></label>
        </div>
      </div>
      <FriendCodes childId={c.id} name={c.name} onChange={() => {}} />
      {groups.map((g) => (
        <div key={g} className="card stack">
          <h3>{g}</h3>
          {PERMISSION_INFO.filter((p) => p.group === g).map((p) => (
            <label key={p.key} className={`toggle ${p.future ? "disabled" : ""}`}>
              <input type="checkbox" disabled={p.future} checked={!!c.permissions[p.key]} onChange={(e) => setPerm(p.key, e.target.checked)} />
              <span><b>{p.label}</b>{p.future && <span className="chip gray" style={{ marginLeft: 6 }}>Coming later</span>}<br /><span className="small muted">{p.help}</span></span>
            </label>
          ))}
          {g === "Learn" && (
            <label className="field">Homework help
              <select value={c.permissions.homeworkMode} onChange={(e) => setPerm("homeworkMode", e.target.value)}>
                <option value="teach">Teach — explain, never give final answers</option>
                <option value="hints">Hints — hints and checking, no final answers</option>
                <option value="answers">Answers allowed — always with the reasoning</option>
              </select>
            </label>
          )}
          {g === "AI" && (
            <label className="field">Daily AI requests: {c.permissions.dailyAiLimit}
              <input type="range" min={0} max={300} step={10} value={c.permissions.dailyAiLimit} onChange={(e) => setPerm("dailyAiLimit", Number(e.target.value))} />
            </label>
          )}
        </div>
      ))}
      <ErrorBox error={saveError} />
      <div className="row" style={{ position: "sticky", bottom: 12 }}>
        <button className="btn big" onClick={save}>Save settings</button>
        {saved && <span className="chip mint">✅ Saved</span>}
        <button className="btn ghost" onClick={() => nav("/parent")}>Done</button>
      </div>
    </div>
  );
}
