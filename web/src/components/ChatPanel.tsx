// A conversation with Spark, the AI mentor. Used by Explore, Learn and project help.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorText } from "../api";
import { useRewards, type Rewards } from "./rewards";
import { Certainty } from "./ui";

interface Meta {
  topic?: string;
  certainty?: "sure" | "mostly" | "unsure";
  checkTip?: string;
  followUp?: string;
  suggestions?: string[];
  sources?: string[];
  note?: string;
  privacyTip?: string | null;
  safety?: boolean;
}
interface Msg {
  role: "user" | "assistant";
  content: string;
  meta?: Meta | null;
}

const ACTIONS: Record<string, { label: string; emoji: string }> = {
  learn_more: { label: "Learn more", emoji: "🔍" },
  picture: { label: "Make a picture", emoji: "🎨" },
  quiz: { label: "Quiz me", emoji: "❓" },
  game: { label: "Make a game", emoji: "🎮" },
  app: { label: "Build an app", emoji: "📱" },
  story: { label: "Write a story", emoji: "📖" },
  mission: { label: "Start a mission", emoji: "🚀" },
};

export function ChatPanel({ thread, placeholder, initial, allowImage, emptyState }: { thread: string; placeholder: string; initial?: string | null; allowImage?: boolean; emptyState?: React.ReactNode }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<{ mediaType: string; data: string; name: string } | null>(null);
  const showRewards = useRewards();
  const nav = useNavigate();
  const end = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    api.get<Msg[]>(`/kid/chat/${thread}`).then((m) => {
      setMsgs(m);
      if (initial && !sentInitial.current) {
        sentInitial.current = true;
        send(initial);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread]);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [msgs, busy]);

  async function send(message: string) {
    if ((!message.trim() && !image) || busy) return;
    setBusy(true);
    setError(null);
    setMsgs((m) => [...m, { role: "user", content: image ? `📷 ${message}` : message }]);
    setText("");
    const img = image;
    setImage(null);
    try {
      const r = await api.post<{ message: Msg; rewards: Rewards | null }>("/kid/chat", {
        thread,
        message,
        ...(img ? { image: { mediaType: img.mediaType, data: img.data } } : {}),
      });
      setMsgs((m) => [...m, r.message]);
      showRewards(r.rewards);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const act = (action: string, topic: string, context: string) => {
    const t = topic || "this";
    const notes = encodeURIComponent(context.slice(0, 500));
    switch (action) {
      case "learn_more": return send(`Tell me more about ${t}!`);
      case "picture": return nav(`/kid/create?type=image&prompt=${encodeURIComponent(`Me exploring ${t}`)}`);
      case "story": return nav(`/kid/create?type=story&prompt=${encodeURIComponent(`A story about ${t}`)}`);
      case "game": return nav(`/kid/build?idea=${encodeURIComponent(`A game about ${t}`)}&notes=${notes}`);
      case "quiz": return nav(`/kid/build?kind=quiz&idea=${encodeURIComponent(`A ${t} quiz`)}&notes=${notes}`);
      case "app": return nav(`/kid/apps?idea=${encodeURIComponent(`An app about ${t}`)}`);
      case "mission": return nav("/kid/missions");
    }
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5_000_000) return setError("That photo is too big (max 5 MB).");
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result);
      setImage({ mediaType: f.type, data: s.slice(s.indexOf(",") + 1), name: f.name });
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="stack">
      <div className="chat">
        {msgs.length === 0 && !busy && emptyState}
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content}
            {m.role === "assistant" && m.meta && !m.meta.safety && (
              <>
                {(m.meta.certainty || m.meta.checkTip) && (
                  <div className="meta">
                    {m.meta.certainty && <Certainty value={m.meta.certainty} />}
                    {m.meta.checkTip && <span className="chip gray">🔎 {m.meta.checkTip}</span>}
                  </div>
                )}
                {!!m.meta.sources?.length && (
                  <div className="meta">
                    <span className="small muted" style={{ fontWeight: 800 }}>📚 Sources:</span>
                    {m.meta.sources.map((u) => (
                      <a key={u} className="chip gray" href={u} target="_blank" rel="noreferrer noopener">{new URL(u).hostname.replace(/^www\./, "")}</a>
                    ))}
                  </div>
                )}
                {m.meta.followUp && <div className="follow">💭 {m.meta.followUp}</div>}
                {i === msgs.length - 1 && !!m.meta.suggestions?.length && (
                  <div className="meta">
                    {m.meta.suggestions.filter((s) => ACTIONS[s]).map((s) => (
                      <button key={s} className="chip" onClick={() => act(s, m.meta?.topic ?? "", m.content)}>
                        {ACTIONS[s].emoji} {ACTIONS[s].label}
                      </button>
                    ))}
                  </div>
                )}
                {(m.meta.note || m.meta.privacyTip) && <div className="note" style={{ marginTop: 10 }}>{m.meta.privacyTip ?? m.meta.note}</div>}
              </>
            )}
          </div>
        ))}
        {busy && <div className="bubble assistant"><span className="typing"><i /><i /><i /></span></div>}
        {error && <div className="error">{error}</div>}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        {allowImage && (
          <label className="btn ghost sm" style={{ cursor: "pointer" }} title="Add a photo of your worksheet">
            📷<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        )}
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={image ? `📷 ${image.name} — add a question` : placeholder} maxLength={2000} />
        <button className="btn" disabled={busy || (!text.trim() && !image)}>Send</button>
      </form>
    </div>
  );
}
