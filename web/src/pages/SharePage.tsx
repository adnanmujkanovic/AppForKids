// Public share page: "Look what I made!" — minimal identity, play first, honest about AI.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, errorText } from "../api";
import { useSession } from "../session";
import { Brand } from "../components/Shells";
import { ErrorBox, Loading, TYPE_INFO, useLoad } from "../components/ui";
import { SceneView } from "../components/SceneView";
import { GamePlayer } from "../game/GamePlayer";
import { AppPlayer } from "../game/AppPlayer";
import { StoryView } from "../game/CreationEditors";
import type { GameSpec } from "../../../shared/game";
import type { AppSpec } from "../../../shared/app";
import type { SceneSpec, StorySpec } from "../../../shared/creations";

interface Shared {
  token: string;
  type: "game" | "app" | "image" | "story";
  title: string;
  emoji: string;
  idea: string;
  description: string;
  spec: unknown;
  creator: string;
  learned: string[];
  aiHelped: string[];
  changed: string[];
  allowRemix: boolean;
  preview?: boolean;
}

export function SharePage() {
  const { token, who, slug } = useParams();
  const { me } = useSession();
  const nav = useNavigate();
  const url = token ? `/share/${token}` : `/p/${who}/${slug}`;
  const { data, error } = useLoad(() => api.get<Shared>(url), [url]);
  const [remixErr, setRemixErr] = useState<string | null>(null);
  const counted = useRef(false);
  useEffect(() => {
    if (data && data.type !== "game" && !counted.current && !data.preview) {
      counted.current = true;
      api.post(`/share/${data.token}/played`).catch(() => {});
    }
  }, [data]);
  if (error) return <main className="container narrow"><div style={{ margin: "24px 0" }}><Brand /></div><ErrorBox error={error} /></main>;
  if (!data) return <Loading />;
  const remix = async () => {
    try {
      const r = await api.post<{ project: { id: string } }>(`/kid/remix/${data.token}`);
      nav(`/kid/project/${r.project.id}?tab=build`);
    } catch (e) {
      setRemixErr(errorText(e));
    }
  };
  return (
    <>
      <header className="topbar"><div className="inner"><Brand /><span className="spacer" />{data.preview && <span className="chip sun">Parent preview</span>}</div></header>
      <main className="container stack" style={{ gap: 18 }}>
        <div className="center">
          <span className="chip gray">{TYPE_INFO[data.type].emoji} {TYPE_INFO[data.type].label}</span>
          <h1 style={{ marginTop: 10 }}>{data.emoji} {data.title}</h1>
          <p className="muted" style={{ fontWeight: 800 }}>Made by {data.creator} with SparkForge</p>
        </div>
        {data.type === "game" && (
          <GamePlayer
            spec={data.spec as GameSpec}
            onStart={() => {
              if (!counted.current && !data.preview) {
                counted.current = true;
                api.post(`/share/${data.token}/played`).catch(() => {});
              }
            }}
          />
        )}
        {data.type === "app" && <AppPlayer spec={data.spec as AppSpec} />}
        {data.type === "image" && <div className="card scenecard" style={{ maxWidth: 640, margin: "0 auto", padding: 12 }}><SceneView scene={data.spec as SceneSpec} /></div>}
        {data.type === "story" && <StoryView story={data.spec as StorySpec} />}
        <div className="grid two narrow" style={{ width: "100%" }}>
          <div className="card"><h3>What is it?</h3><p style={{ margin: 0 }}>{data.description || data.idea}</p></div>
          {data.learned.length > 0 && <div className="card"><h3>💡 What I learned</h3><div className="row" style={{ gap: 6 }}>{data.learned.map((l) => <span key={l} className="chip sky">{l}</span>)}</div></div>}
          {data.aiHelped.length > 0 && <div className="card"><h3>🤖 AI helped me</h3><ul style={{ margin: 0, paddingLeft: 18 }}>{data.aiHelped.map((l, i) => <li key={i}>{l}</li>)}</ul></div>}
          {data.changed.length > 0 && <div className="card"><h3>✏️ I changed</h3><ul style={{ margin: 0, paddingLeft: 18 }}>{data.changed.map((l, i) => <li key={i}>{l}</li>)}</ul></div>}
        </div>
        <div className="card center stack narrow" style={{ width: "100%" }}>
          {data.allowRemix && me?.role === "child" ? (
            <button className="btn big coral" onClick={remix}>🔄 Remix it — make my own version</button>
          ) : data.allowRemix ? (
            <p style={{ margin: 0 }}>🔄 This creation can be remixed. Open it while signed in to SparkForge to make your own version!</p>
          ) : (
            <p style={{ margin: 0 }}>✨ Want to make something like this?</p>
          )}
          {remixErr && <div className="error">{remixErr}</div>}
          <Link to="/" className="btn ghost">Discover SparkForge Kids</Link>
        </div>
      </main>
    </>
  );
}
