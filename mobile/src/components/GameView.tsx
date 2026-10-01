import { useEffect, useMemo, useRef } from "react";
import { ENGINE_JS } from "../generated/runtime";
import { codeHtml, gameHtml } from "../../../shared/export";
import type { GameSpec } from "../../../shared/game";
import type { CodeSpec } from "../../../shared/creations";
import { EngineView, type EngineMessage } from "./EngineView";

/** Plays a game made in SparkForge (the same engine as the web app and exported pages). */
export function GameView({ spec, onEnd }: { spec: GameSpec; onEnd?: (r: { result: "won" | "lost"; score: number }) => void }) {
  const html = useMemo(() => gameHtml(ENGINE_JS, spec), [spec]);
  return (
    <EngineView
      html={html}
      onMessage={(m) => {
        if (m.sparkforge === "end" && m.result) onEnd?.({ result: m.result, score: m.score ?? 0 });
      }}
    />
  );
}

export interface RunError {
  message: string;
  line: number | null;
}

/** Runs a child's JavaScript. Error line numbers are mapped back to their code. */
export function CodeView({ spec, runId, onRan }: { spec: CodeSpec; runId: number; onRan?: (ok: boolean, err?: RunError) => void }) {
  const built = useMemo(() => codeHtml(ENGINE_JS, spec.title, spec.source), [spec.title, spec.source]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reported = useRef(false);
  useEffect(() => {
    reported.current = false;
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [built, runId]);
  const handle = (m: EngineMessage) => {
    if (m.sparkforge === "error") {
      if (timer.current) clearTimeout(timer.current);
      const line = typeof m.line === "number" && m.line > built.lineOffset ? m.line - built.lineOffset : null;
      if (!reported.current) onRan?.(false, { message: m.message ?? "Error", line });
      reported.current = true;
    } else if (m.sparkforge === "ready") {
      // The engine loaded. If the child's code throws, an error arrives right after; otherwise it ran.
      timer.current = setTimeout(() => {
        if (!reported.current) onRan?.(true);
        reported.current = true;
      }, 1500);
    }
  };
  return <EngineView key={runId} html={built.html} onMessage={handle} />;
}
