// Code Mode: children write real JavaScript. It runs in a sandboxed iframe with no network,
// no storage and no access to SparkForge — only the tiny SparkForge game engine.
import { useEffect, useMemo, useRef, useState } from "react";
import engineJs from "../../../shared/runtime/engine.js?raw";
import { codeHtml } from "../../../shared/export";
import type { CodeSpec } from "../../../shared/creations";

export interface RunError {
  message: string;
  line: number | null;
}

export function CodeRunner({ spec, runId, onRan }: { spec: CodeSpec; runId?: number; onRan?: (ok: boolean, error?: RunError) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<RunError | null>(null);
  const [key, setKey] = useState(0);
  const built = useMemo(() => codeHtml(engineJs, spec.title, spec.source), [spec.title, spec.source]);
  const reported = useRef(false);
  const ranRef = useRef(onRan);
  ranRef.current = onRan;

  useEffect(() => {
    setError(null);
    reported.current = false;
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data?.sparkforge) return;
      if (e.data.sparkforge === "error") {
        const line = typeof e.data.line === "number" && e.data.line > built.lineOffset ? e.data.line - built.lineOffset : null;
        const err = { message: String(e.data.message ?? "Error"), line };
        setError(err);
        if (!reported.current) {
          reported.current = true;
          ranRef.current?.(false, err);
        }
      }
    };
    window.addEventListener("message", onMsg);
    // If no error shows up shortly after starting, the program ran.
    const t = setTimeout(() => {
      if (!reported.current) {
        reported.current = true;
        ranRef.current?.(true);
      }
    }, 1500);
    return () => {
      window.removeEventListener("message", onMsg);
      clearTimeout(t);
    };
  }, [built, key, runId]);

  return (
    <div className="stack">
      <div className="row between">
        <span className="chip mint">🔒 Sandbox: no internet, no personal data</span>
        <button className="btn sm ghost" onClick={() => setKey((k) => k + 1)}>↻ Restart</button>
      </div>
      <iframe
        key={`${key}-${runId ?? 0}`}
        ref={frame}
        title="Code preview"
        sandbox="allow-scripts"
        srcDoc={built.html}
        style={{ width: "100%", maxWidth: 440, height: 640, border: 0, borderRadius: 20, background: "#f8f5ff", margin: "0 auto", display: "block" }}
      />
      {error && (
        <div className="bugcard">
          <b>🐛 {error.line ? `Line ${error.line}: ` : ""}{error.message}</b>
          <p className="small muted" style={{ margin: "6px 0 0" }}>Bugs are normal! Read the line, check spelling and brackets, or ask AI for a hint.</p>
        </div>
      )}
    </div>
  );
}

export function CodeEditor({ spec, onSave, saving, errorLine }: { spec: CodeSpec; onSave: (s: CodeSpec) => void; saving?: boolean; errorLine?: number | null }) {
  const [src, setSrc] = useState(spec.source);
  const [title, setTitle] = useState(spec.title);
  const area = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setSrc(spec.source);
    setTitle(spec.title);
  }, [spec]);
  const dirty = src !== spec.source || title !== spec.title;
  const lines = src.split("\n").length;
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const t = e.currentTarget;
      const { selectionStart: a, selectionEnd: b } = t;
      const next = `${src.slice(0, a)}  ${src.slice(b)}`;
      setSrc(next);
      requestAnimationFrame(() => t.setSelectionRange(a + 2, a + 2));
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (dirty) onSave({ ...spec, title, source: src });
    }
  };
  return (
    <div className="stack">
      <div className="row between card flat" style={{ padding: 12 }}>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ maxWidth: 260 }} aria-label="Title" />
        <div className="row">
          <button className="btn ghost sm" disabled={!dirty} onClick={() => { setSrc(spec.source); setTitle(spec.title); }}>Undo</button>
          <button className="btn mint sm" disabled={!dirty || saving} onClick={() => onSave({ ...spec, title, source: src })}>{saving ? "Saving…" : "💾 Save & run"}</button>
        </div>
      </div>
      <div className="codeedit">
        <div ref={gutter} className="gutter" aria-hidden>
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className={errorLine === i + 1 ? "err" : ""}>{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={area}
          value={src}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onKeyDown={onKey}
          onChange={(e) => setSrc(e.target.value)}
          onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }}
          aria-label="Code editor"
        />
      </div>
      <details className="card flat">
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>📖 Engine cheat sheet</summary>
        <div className="code small" style={{ marginTop: 8 }}>{`game.score  game.lives  game.level  game.time      // variables
game.onCollect((thing) => { ... })   // when you touch a collectible
game.onHit((danger) => { ... })      // when you touch a danger
game.onFrame(() => { ... })          // ~60 times a second
game.onLevel((level) => { ... })     // when a level starts
game.onAnswer(({ correct }) => { })  // quiz answers
game.say("Hi!")   game.spawn("⭐", { points: 5 })
game.nextLevel()  game.win("Yay")  game.over("Oops")
game.target()     // points needed for this level`}</div>
      </details>
    </div>
  );
}
