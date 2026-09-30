// Celebrations for meaningful achievements: medals, new concepts and level-ups.
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface Rewards {
  medals: { id: string; emoji: string; title: string; about: string; hidden?: boolean }[];
  concepts: { name: string; emoji: string; text: string }[];
  levelUp: { id: string; emoji: string; label: string } | null;
}

type Item =
  | { kind: "medal"; emoji: string; title: string; text: string; hidden?: boolean }
  | { kind: "concept"; emoji: string; title: string; text: string }
  | { kind: "level"; emoji: string; title: string; text: string };

const Ctx = createContext<(r: Rewards | null | undefined) => void>(() => {});
export const useRewards = () => useContext(Ctx);

export function RewardsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Item[]>([]);
  const show = useCallback((r: Rewards | null | undefined) => {
    if (!r) return;
    const items: Item[] = [
      ...r.medals.map((m) => ({ kind: "medal" as const, emoji: m.emoji, title: m.title, text: m.about, hidden: m.hidden })),
      ...(r.levelUp ? [{ kind: "level" as const, emoji: r.levelUp.emoji, title: r.levelUp.label, text: "You reached a new creator level!" }] : []),
      ...r.concepts.slice(0, 2).map((c) => ({ kind: "concept" as const, emoji: c.emoji, title: c.name, text: c.text })),
    ];
    if (items.length) setQueue((q) => [...q, ...items]);
  }, []);
  const cur = queue[0];
  return (
    <Ctx.Provider value={show}>
      {children}
      {cur && (
        <div className="rewards" onClick={() => setQueue((q) => q.slice(1))}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <div className="chip sun" style={{ marginBottom: 12 }}>
              {cur.kind === "medal" ? (cur.hidden ? "🎁 Surprise medal!" : "🏅 New medal!") : cur.kind === "level" ? "⬆️ Level up!" : "💡 New concept discovered"}
            </div>
            <div className="big">{cur.emoji}</div>
            <h2 style={{ marginTop: 10 }}>{cur.title}</h2>
            <p className="muted">{cur.text}</p>
            <button className="btn big" onClick={() => setQueue((q) => q.slice(1))}>
              {queue.length > 1 ? "Next ✨" : "Awesome!"}
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
