// Editors for pictures (drag elements around) and stories (edit the words).
import { useEffect, useState } from "react";
import type { SceneSpec, StorySpec } from "../../../shared/creations";
import { SceneView } from "../components/SceneView";

function SaveBar({ dirty, saving, onUndo, onSave }: { dirty: boolean; saving?: boolean; onUndo: () => void; onSave: () => void }) {
  return (
    <div className="row between card flat" style={{ padding: 12 }}>
      <span className="muted small" style={{ fontWeight: 800 }}>{dirty ? "✏️ Unsaved changes" : "Make it yours, then save."}</span>
      <div className="row">
        <button className="btn ghost sm" disabled={!dirty} onClick={onUndo}>Undo</button>
        <button className="btn mint sm" disabled={!dirty || saving} onClick={onSave}>💾 Save version</button>
      </div>
    </div>
  );
}

export function SceneEditor({ spec, onSave, saving }: { spec: SceneSpec; onSave: (s: SceneSpec) => void; saving?: boolean }) {
  const [d, setD] = useState(spec);
  useEffect(() => setD(spec), [spec]);
  const dirty = JSON.stringify(d) !== JSON.stringify(spec);
  return (
    <div className="stack">
      <SaveBar dirty={dirty} saving={saving} onUndo={() => setD(spec)} onSave={() => onSave(d)} />
      <p className="small muted">Drag things around in the picture. Change emojis, labels and sizes below.</p>
      <div className="scenecard"><SceneView scene={d} onChange={setD} /></div>
      <div className="section">
        <label className="field">Title<input type="text" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></label>
        <label className="field" style={{ marginTop: 8 }}>Caption<input type="text" value={d.caption} onChange={(e) => setD({ ...d, caption: e.target.value })} /></label>
        <div className="row" style={{ marginTop: 8 }}>
          <label className="row small" style={{ fontWeight: 800 }}>Sky <input type="color" value={d.sky} onChange={(e) => setD({ ...d, sky: e.target.value })} /></label>
          <label className="row small" style={{ fontWeight: 800 }}>Ground <input type="color" value={d.ground} onChange={(e) => setD({ ...d, ground: e.target.value })} /></label>
        </div>
      </div>
      <div className="section">
        {d.elements.map((el, i) => (
          <div key={i} className="itemrow">
            <input type="text" className="emo" value={el.emoji} onChange={(e) => setD({ ...d, elements: d.elements.map((x, j) => (j === i ? { ...x, emoji: e.target.value } : x)) })} />
            <input type="text" value={el.label} placeholder="label" onChange={(e) => setD({ ...d, elements: d.elements.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <input type="range" min={4} max={40} value={el.size} title="size" onChange={(e) => setD({ ...d, elements: d.elements.map((x, j) => (j === i ? { ...x, size: Number(e.target.value) } : x)) })} />
            <button className="btn danger sm" onClick={() => setD({ ...d, elements: d.elements.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        {d.elements.length < 14 && (
          <button className="btn ghost sm" onClick={() => setD({ ...d, elements: [...d.elements, { emoji: "⭐", label: "", x: 50, y: 40, size: 12 }] })}>+ Add something</button>
        )}
      </div>
    </div>
  );
}

export function StoryEditor({ spec, onSave, saving }: { spec: StorySpec; onSave: (s: StorySpec) => void; saving?: boolean }) {
  const [d, setD] = useState(spec);
  useEffect(() => setD(spec), [spec]);
  const dirty = JSON.stringify(d) !== JSON.stringify(spec);
  return (
    <div className="stack">
      <SaveBar dirty={dirty} saving={saving} onUndo={() => setD(spec)} onSave={() => onSave(d)} />
      <label className="field">Title<input type="text" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></label>
      {d.pages.map((p, i) => (
        <div key={i} className="section">
          <div className="itemrow wide">
            <input type="text" className="emo" value={p.emoji} onChange={(e) => setD({ ...d, pages: d.pages.map((x, j) => (j === i ? { ...x, emoji: e.target.value } : x)) })} />
            <b>Page {i + 1}</b>
          </div>
          <textarea value={p.text} onChange={(e) => setD({ ...d, pages: d.pages.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
          <button className="btn danger sm" onClick={() => setD({ ...d, pages: d.pages.filter((_, j) => j !== i) })}>Remove page</button>
        </div>
      ))}
      {d.pages.length < 10 && <button className="btn ghost sm" onClick={() => setD({ ...d, pages: [...d.pages, { text: "", emoji: "✨" }] })}>+ Add page</button>}
      <label className="field">The lesson<input type="text" value={d.moral} onChange={(e) => setD({ ...d, moral: e.target.value })} /></label>
    </div>
  );
}

export function StoryView({ story }: { story: StorySpec }) {
  const [page, setPage] = useState(0);
  const p = story.pages[page];
  return (
    <div className="card" style={{ maxWidth: 620, margin: "0 auto" }}>
      <h2 className="center">{story.title}</h2>
      {p ? (
        <>
          <div className="center" style={{ fontSize: "4rem" }}>{p.emoji}</div>
          <p className="story-page">{p.text}</p>
        </>
      ) : (
        <p className="muted">This story has no pages yet.</p>
      )}
      {page === story.pages.length - 1 && story.moral && <div className="note">✨ {story.moral}</div>}
      <div className="row between" style={{ marginTop: 12 }}>
        <button className="btn ghost sm" disabled={page === 0} onClick={() => setPage(page - 1)}>← Back</button>
        <span className="muted small">Page {Math.min(page + 1, story.pages.length)} of {story.pages.length}</span>
        <button className="btn sm" disabled={page >= story.pages.length - 1} onClick={() => setPage(page + 1)}>Next →</button>
      </div>
    </div>
  );
}
