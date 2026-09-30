import { useCallback, useEffect, useState, type ReactNode } from "react";
import { errorText } from "../api";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="building">
      <div className="spinner" />
      <p className="muted" style={{ marginTop: 12 }}>{label}</p>
    </div>
  );
}

export function Building({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="building card">
      <span className="e">{emoji}</span>
      <h2 style={{ marginTop: 12 }}>{label}</h2>
      <p className="muted">AI is putting the pieces together…</p>
    </div>
  );
}

export const ErrorBox = ({ error }: { error: unknown }) => (error ? <div className="error">{errorText(error)}</div> : null);
export const Note = ({ children }: { children: ReactNode }) => (children ? <div className="note">{children}</div> : null);

/** Load data on mount / when deps change. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fn());
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Certainty({ value }: { value: "sure" | "mostly" | "unsure" }) {
  const m = {
    sure: { c: "mint", t: "✅ Well-known fact" },
    mostly: { c: "sun", t: "🤔 Mostly sure" },
    unsure: { c: "coral", t: "❓ Not sure — check this" },
  }[value];
  return <span className={`chip ${m.c}`}>{m.t}</span>;
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export const TYPE_INFO: Record<string, { emoji: string; label: string }> = {
  game: { emoji: "🎮", label: "Game" },
  app: { emoji: "📱", label: "App" },
  image: { emoji: "🎨", label: "Picture" },
  story: { emoji: "📖", label: "Story" },
  code: { emoji: "⌨️", label: "Code" },
};
