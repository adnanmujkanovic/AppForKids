import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useSession } from "../session";
import { Brand } from "../components/Shells";
import { ErrorBox, Loading } from "../components/ui";
import { SceneView } from "../components/SceneView";

const demoScene = {
  title: "Me on Mars",
  caption: "",
  style: "land" as const,
  sky: "#e8a36b",
  ground: "#b5532e",
  elements: [
    { emoji: "🌋", label: "Olympus Mons", x: 72, y: 50, size: 28 },
    { emoji: "🧑‍🚀", label: "Me!", x: 34, y: 66, size: 20 },
    { emoji: "🚙", label: "Rover", x: 52, y: 74, size: 14 },
    { emoji: "🪐", label: "", x: 16, y: 20, size: 12 },
    { emoji: "🛰️", label: "", x: 86, y: 14, size: 9 },
    { emoji: "🪨", label: "", x: 10, y: 80, size: 9 },
  ],
};

export function Landing() {
  const { me } = useSession();
  if (!me) return <Loading />;
  if (me.role === "parent") return <Navigate to="/parent" replace />;
  if (me.role === "child") return <Navigate to="/kid" replace />;
  return (
    <>
      <header className="topbar">
        <div className="inner">
          <Brand />
          <span className="spacer" />
          <Link to="/login" className="btn ghost sm">Sign in</Link>
        </div>
      </header>
      <main className="container">
        <section className="landing-hero">
          <div>
            <span className="chip sun">Ask. Create. Build. Share.</span>
            <h1 style={{ marginTop: 14 }}>Kids turn curiosity into things they can proudly say: <span style={{ color: "var(--violet)" }}>“I made this.”</span></h1>
            <p style={{ fontSize: "1.15rem", color: "var(--ink-2)" }}>
              SparkForge is an AI creation studio for children. They ask questions, make pictures and stories, build real games and apps, find
              and fix bugs — and learn engineering along the way.
            </p>
            <div className="row" style={{ marginTop: 18 }}>
              <Link to="/register" className="btn big">Create a family account</Link>
              <Link to="/login" className="btn ghost big">Sign in</Link>
            </div>
            <div className="loop" style={{ marginTop: 22 }}>
              {["🔭 Curiosity", "🎨 Create", "🧩 Build", "▶ Play", "🐛 Debug", "🔄 Improve", "👋 Share", "💡 Learn"].map((s) => (
                <span key={s} className="chip gray">{s}</span>
              ))}
            </div>
          </div>
          <div className="card scenecard" style={{ padding: 12 }}>
            <SceneView scene={demoScene} />
            <p className="small muted center" style={{ margin: "10px 0 0" }}>“Put me on Mars!” — made with SparkForge</p>
          </div>
        </section>
        <section className="grid two" style={{ marginTop: 20 }}>
          <div className="card tint-violet">
            <h3>🛠️ Technically real</h3>
            <p>Games and apps are built from a real project model: variables, events, conditions, data. Kids see the code, test it, and fix bugs.</p>
          </div>
          <div className="card tint-mint">
            <h3>🛡️ Safe by design</h3>
            <p>Parent-first accounts, granular permissions, private sharing by default, personal-info filtering and safety alerts — without reading every chat.</p>
          </div>
          <div className="card tint-sun">
            <h3>🤝 Honest about AI</h3>
            <p>Every project shows what the child did and what AI helped with. Missions like AI Detective teach that AI can be wrong.</p>
          </div>
          <div className="card tint-coral">
            <h3>🏅 Rewards that matter</h3>
            <p>Medals for creating, testing, debugging and sharing — never for screen time. No followers, no likes, no infinite feeds.</p>
          </div>
        </section>
      </main>
    </>
  );
}

export function Login() {
  const [params] = useSearchParams();
  const grownup = params.get("grownup");
  const { refresh } = useSession();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/login", { email, password });
      await refresh();
      nav("/parent");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="container narrow" style={{ maxWidth: 440 }}>
      <div style={{ margin: "24px 0" }}><Brand /></div>
      <form className="card stack" onSubmit={submit}>
        <h2>{grownup ? "👪 Grown-ups only" : "Welcome back"}</h2>
        {grownup && <p className="muted">Enter the parent password to open the parent area. <Link to="/kid">← Back to creating</Link></p>}
        <label className="field">Parent email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="field">Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <ErrorBox error={error} />
        <button className="btn big" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        {!grownup && <p className="small muted center">New here? <Link to="/register">Create a family account</Link></p>}
      </form>
    </main>
  );
}

export function Register() {
  const { refresh } = useSession();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", email: "", password: "", familyName: "" });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/register", f);
      await refresh();
      nav("/parent?welcome=1");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="container narrow" style={{ maxWidth: 480 }}>
      <div style={{ margin: "24px 0" }}><Brand /></div>
      <form className="card stack" onSubmit={submit}>
        <h2>Create your family</h2>
        <p className="muted">Parents set up SparkForge. You'll add your child's profile and choose what they can do next.</p>
        <label className="field">Your name<input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <label className="field">Family name (optional)<input type="text" value={f.familyName} placeholder="The Rivera family" onChange={(e) => setF({ ...f, familyName: e.target.value })} /></label>
        <label className="field">Email<input type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></label>
        <label className="field">Password (8+ characters)<input type="password" autoComplete="new-password" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></label>
        <ErrorBox error={error} />
        <button className="btn big" disabled={busy}>{busy ? "Creating…" : "Create family account"}</button>
        <p className="small muted center">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </main>
  );
}
