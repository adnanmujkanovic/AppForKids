import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorText } from "../api";
import { useRewards, type Rewards } from "../components/rewards";
import { Building, ErrorBox, Loading, Note, TYPE_INFO, timeAgo, useLoad } from "../components/ui";

interface FriendsData {
  enabled: boolean;
  friends: { id: string; name: string; avatar: string }[];
  inbox: { id: string; token: string; note: string; seen: boolean; createdAt: string; from: { name: string; avatar: string }; title: string; emoji: string; type: string }[];
  team: { id: string; title: string; emoji: string; type: string; owner: string }[];
}

export function FriendsPage() {
  const { data, error } = useLoad(() => api.get<FriendsData>("/kid/friends"));
  useEffect(() => {
    if (data?.inbox.some((i) => !i.seen)) api.post("/kid/inbox/seen").catch(() => {});
  }, [data]);
  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  return (
    <div className="narrow stack">
      <h1>🤝 Friends</h1>
      {!data.enabled ? (
        <div className="card">🔒 Friends are turned off in your family settings. Ask a parent!</div>
      ) : (
        <>
          <div className="card stack">
            <h3>My friends</h3>
            {data.friends.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No friends yet. Friends are added by grown-ups: one parent makes a <b>friend code</b>, and the other parent enters it. That keeps everyone safe!</p>
            ) : (
              <div className="row">{data.friends.map((f) => <span key={f.id} className="chip">{f.avatar} {f.name}</span>)}</div>
            )}
          </div>
          <div className="card stack">
            <h3>📬 Sent to me</h3>
            {data.inbox.length === 0 && <p className="muted small" style={{ margin: 0 }}>Nothing yet.</p>}
            {data.inbox.map((i) => (
              <Link key={i.id} to={`/s/${i.token}`} className="tile" style={{ minHeight: 0, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: "2rem" }}>{i.emoji}</span>
                <span style={{ flex: 1 }}>
                  <b>{i.title}</b> {!i.seen && <span className="chip coral">new</span>}<br />
                  <span className="small muted">{i.from.avatar} {i.from.name}: “{i.note}” · {timeAgo(i.createdAt)}</span>
                </span>
                <span className="btn sm">{i.type === "game" || i.type === "code" ? "▶ Play" : "Open"}</span>
              </Link>
            ))}
          </div>
          {data.team.length > 0 && (
            <div className="card stack">
              <h3>👥 Building together</h3>
              {data.team.map((t) => (
                <Link key={t.id} to={`/kid/project/${t.id}?tab=team`} className="row between" style={{ color: "var(--ink)" }}>
                  <span>{t.emoji} <b>{t.title}</b> <span className="muted small">with {t.owner}</span></span>
                  <span className="chip gray">{TYPE_INFO[t.type]?.label}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface FeedItem { token: string; slug: string | null; title: string; emoji: string; type: string; description: string; creator: string; createdAt: string }

export function FeedPage() {
  const { data, error } = useLoad(() => api.get<FeedItem[]>("/kid/feed"));
  if (error) return <div className="narrow"><h1>🌍 Creator Feed</h1><ErrorBox error={error} /></div>;
  if (!data) return <Loading />;
  return (
    <div className="stack">
      <h1>🌍 Creator Feed</h1>
      <p className="muted">Things other kids made and published. Newest first — no likes, no rankings, just creations.</p>
      {data.length === 0 && <div className="card">Nothing published yet. Be the first!</div>}
      <div className="grid">
        {data.map((f) => (
          <div key={f.token} className="card stack" style={{ gap: 8 }}>
            <div style={{ fontSize: "2.2rem" }}>{f.emoji}</div>
            <b>{f.title}</b>
            <span className="small muted">{TYPE_INFO[f.type]?.emoji} by {f.creator} · {timeAgo(f.createdAt)}</span>
            {f.description && <span className="small">{f.description}</span>}
            <div className="row" style={{ gap: 6 }}>
              <Link className="btn sm" to={`/s/${f.token}`}>▶ Play</Link>
              <Link className="btn ghost sm" to={`/kid/build?idea=${encodeURIComponent(`My own version of ${f.title}`)}`}>✨ Make my own</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Plan { id: string; title: string; steps: { text: string; when: string; done: boolean }[]; tip?: string }

export function PlannerPage() {
  const { data, reload, setData } = useLoad(() => api.get<Plan[]>("/kid/plans"));
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const save = async (p: Plan) => {
    setData((data ?? []).map((x) => (x.id === p.id ? p : x)));
    try {
      await api.put(`/kid/plans/${p.id}`, { title: p.title, steps: p.steps });
    } catch (e) {
      setErr(errorText(e));
      reload();
    }
  };
  return (
    <div className="narrow stack">
      <h1>🗓️ Planner</h1>
      <p className="muted">Turn a big thing into small steps. AI suggests a plan — you're the boss of it: change, add or remove anything.</p>
      <form className="card row" style={{ flexWrap: "nowrap" }} onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          const r = await api.post<{ plan: Plan; note?: string }>("/kid/plans", { goal });
          setTip(r.plan.tip ?? null);
          setGoal("");
          await reload();
        } catch (ex) {
          setErr(errorText(ex));
        } finally {
          setBusy(false);
        }
      }}>
        <input type="text" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Get ready for my science test on Friday" maxLength={200} />
        <button className="btn" disabled={busy || goal.trim().length < 3}>{busy ? "…" : "Make a plan"}</button>
      </form>
      {err && <div className="error">{err}</div>}
      <Note>{tip}</Note>
      {data?.map((p) => {
        const done = p.steps.filter((s) => s.done).length;
        return (
          <div key={p.id} className="card stack">
            <div className="row between">
              <input type="text" value={p.title} onChange={(e) => setData(data.map((x) => (x.id === p.id ? { ...x, title: e.target.value } : x)))} onBlur={() => save(p)} style={{ fontWeight: 900, maxWidth: 360 }} aria-label="Plan title" />
              <span className="chip mint">{done}/{p.steps.length}</span>
            </div>
            <div className="progress"><i style={{ width: `${p.steps.length ? (done / p.steps.length) * 100 : 0}%` }} /></div>
            {p.steps.map((s, i) => (
              <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
                <input type="checkbox" checked={s.done} style={{ width: 22, height: 22, accentColor: "var(--violet)" }} onChange={(e) => save({ ...p, steps: p.steps.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })} aria-label="Done" />
                <input type="text" value={s.text} style={{ textDecoration: s.done ? "line-through" : "none" }} onChange={(e) => setData(data.map((x) => (x.id === p.id ? { ...x, steps: x.steps.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) } : x)))} onBlur={() => save(data.find((x) => x.id === p.id)!)} />
                {s.when && <span className="chip gray" style={{ flex: "0 0 auto" }}>{s.when}</span>}
                <button className="linkbtn" onClick={() => save({ ...p, steps: p.steps.filter((_, j) => j !== i) })} aria-label="Remove">✕</button>
              </div>
            ))}
            <div className="row">
              <button className="btn ghost sm" onClick={() => save({ ...p, steps: [...p.steps, { text: "New step", when: "", done: false }] })}>+ Step</button>
              <button className="btn danger sm" onClick={async () => { await api.del(`/kid/plans/${p.id}`); reload(); }}>Delete plan</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function NewCode() {
  const nav = useNavigate();
  const showRewards = useRewards();
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  if (busy) return <Building emoji="⌨️" label="Setting up your code…" />;
  return (
    <div className="narrow stack">
      <h1>⌨️ Code Mode</h1>
      <div className="card tint-violet stack">
        <p style={{ margin: 0 }}>Write a game in <b>real JavaScript</b> — the language that runs the web. You'll start with a working game, then change the code and press ▶ Run.</p>
        <p className="small" style={{ margin: 0 }}>🔒 Your code runs in a sandbox: it can't use the internet or see anything personal.</p>
      </div>
      <div className="card stack">
        <label className="field">Name your project<input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Star Coder" maxLength={60} /></label>
        <button className="btn big" onClick={async () => {
          setBusy(true);
          try {
            const r = await api.post<{ project: { id: string }; rewards: Rewards }>("/kid/code", { title });
            showRewards(r.rewards);
            nav(`/kid/project/${r.project.id}?tab=build`);
          } catch (e) {
            setErr(errorText(e));
            setBusy(false);
          }
        }}>Start coding →</button>
        <p className="small muted" style={{ margin: 0 }}>Tip: you can also open any game you built in Code Mode from its <b>{"</>"} CODE</b> tab.</p>
        {err && <div className="error">{err}</div>}
      </div>
    </div>
  );
}
