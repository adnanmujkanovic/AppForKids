import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useSession } from "../session";
import { Loading, timeAgo } from "./ui";

export const Brand = () => (
  <Link to="/" className="brand">
    <span className="mark">✨</span> SparkForge <span className="muted" style={{ fontWeight: 800 }}>Kids</span>
  </Link>
);

interface Notif { id: string; emoji: string; text: string; link: string | null; read: boolean; createdAt: string }

function Bell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    const load = () => api.get<{ notifications: Notif[] }>("/kid/home").then((h) => setItems(h.notifications)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  const unread = items.filter((i) => !i.read).length;
  return (
    <div style={{ position: "relative" }}>
      <button
        className="bell"
        aria-label="Notifications"
        onClick={() => {
          setOpen(!open);
          if (!open && unread) api.post("/kid/notifications/read").then(() => setItems(items.map((i) => ({ ...i, read: true }))));
        }}
      >
        🔔{unread > 0 && <span className="dot">{unread}</span>}
      </button>
      {open && (
        <div className="popover" onMouseLeave={() => setOpen(false)}>
          {items.length === 0 && <p className="muted small" style={{ padding: 10 }}>Nothing yet — go make something!</p>}
          {items.slice(0, 10).map((n) => (
            <a key={n.id} className="item" href={n.link ?? "#"} onClick={(e) => { e.preventDefault(); setOpen(false); if (n.link) nav(n.link); }}>
              <span style={{ fontSize: "1.3rem" }}>{n.emoji}</span>
              <span><span>{n.text}</span><br /><span className="small muted">{timeAgo(n.createdAt)}</span></span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function KidShell({ children }: { children: ReactNode }) {
  const { me } = useSession();
  if (!me) return <Loading />;
  if (me.role !== "child") return <Navigate to={me.role === "parent" ? "/parent" : "/"} replace />;
  return (
    <>
      <header className="topbar">
        <div className="inner">
          <Brand />
          <span className="spacer" />
          {!me.ai.live && <span className="chip sun small" title="No AI model is connected. SparkForge uses a built-in practice helper.">🧪 Practice AI</span>}
          <Bell />
          <Link to="/kid/passport" className="avatar" title="My Creator Passport">{me.child?.avatar}</Link>
          <Link to="/login?grownup=1" className="btn ghost sm" title="Grown-ups: sign in to the parent area">👪</Link>
        </div>
      </header>
      <main className="container">{children}</main>
      <nav className="bottomnav">
        <div className="inner">
          {[
            ["/kid", "🏠", "Home"],
            ["/kid/explore", "🔭", "Explore"],
            ["/kid/create", "🎨", "Create"],
            ["/kid/build", "🎮", "Build"],
            ["/kid/creations", "📦", "Mine"],
          ].map(([to, ic, label]) => (
            <NavLink key={to} to={to} end={to === "/kid"} className={({ isActive }) => (isActive ? "active" : "")}>
              <span className="ic">{ic}</span>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}

export function ParentShell({ children }: { children: ReactNode }) {
  const { me, refresh } = useSession();
  const nav = useNavigate();
  if (!me) return <Loading />;
  if (me.role !== "parent") return <Navigate to={me.role === "child" ? "/kid" : "/login"} replace />;
  return (
    <>
      <header className="topbar">
        <div className="inner">
          <Brand />
          <span className="chip gray">Parent area</span>
          <span className="spacer" />
          <span className="muted small" style={{ fontWeight: 800 }}>{me.parent?.name}</span>
          <button className="btn ghost sm" onClick={async () => { await api.post("/auth/logout"); await refresh(); nav("/"); }}>Sign out</button>
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
