// The game runtime. It renders any GameSpec — the AI never writes executable game code.
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSpec } from "../../../shared/game";

const W = 360;
const H = 480;
const HIT = 30;

type Phase = "ready" | "playing" | "won" | "lost";
export type GameResult = { result: "won" | "lost" | "quit"; score: number };

interface Thing {
  x: number;
  y: number;
  vx: number;
  vy: number;
  emoji: string;
  good: boolean;
  points: number;
  name: string;
  fact: string;
  moves: boolean;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function GamePlayer({ spec, onEnd, onStart }: { spec: GameSpec; onEnd?: (r: GameResult) => void; onStart?: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [hud, setHud] = useState({ score: 0, lives: spec.rules.lives, level: 0, time: spec.rules.timeLimit });
  const [toast, setToast] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [endReason, setEndReason] = useState("");
  const [quizIdx, setQuizIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  // Mutable game state lives in a ref so the loop doesn't re-render every frame.
  const st = useRef({
    score: 0,
    lives: spec.rules.lives,
    level: 0,
    time: spec.rules.timeLimit,
    px: W / 2,
    py: H - 60,
    things: [] as Thing[],
    spawnAcc: 0,
    invuln: 0,
    keys: new Set<string>(),
    target: null as { x: number; y: number } | null,
    seenFacts: new Set<string>(),
    ended: false,
  });
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  const finish = useCallback((result: "won" | "lost", reason: string) => {
    const s = st.current;
    if (s.ended) return;
    s.ended = true;
    setEndReason(reason);
    setPhase(result);
    endRef.current?.({ result, score: s.score });
  }, []);

  const flash = (text: string, ms = 1400) => {
    setBanner(text);
    setTimeout(() => setBanner((b) => (b === text ? null : b)), ms);
  };
  const showFact = (text: string) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 3500);
  };

  const populateExplorer = useCallback(
    (level: number) => {
      const s = st.current;
      const lv = spec.levels[level];
      const items = spec.collectibles.length ? spec.collectibles : [];
      const n = lv ? 4 + lv.spawnRate * 2 : 6;
      const things: Thing[] = [];
      const free = () => {
        for (let i = 0; i < 30; i++) {
          const x = rand(30, W - 30);
          const y = rand(70, H - 30);
          if (Math.hypot(x - s.px, y - s.py) > 90) return { x, y };
        }
        return { x: rand(30, W - 30), y: rand(70, H - 30) };
      };
      for (let i = 0; i < n && items.length; i++) {
        const c = items[i % items.length];
        things.push({ ...free(), vx: 0, vy: 0, emoji: c.emoji, good: true, points: c.points, name: c.name, fact: c.fact, moves: false });
      }
      const hazards = spec.hazards;
      const hn = Math.min(8, hazards.length * (1 + level));
      for (let i = 0; i < hn; i++) {
        const hz = hazards[i % hazards.length];
        const sp = 20 + (lv?.hazardSpeed ?? 3) * 12;
        const a = rand(0, Math.PI * 2);
        things.push({ ...free(), vx: hz.moves ? Math.cos(a) * sp : 0, vy: hz.moves ? Math.sin(a) * sp : 0, emoji: hz.emoji, good: false, points: 0, name: hz.name, fact: "", moves: hz.moves });
      }
      s.things = things;
    },
    [spec],
  );

  const start = () => {
    const s = st.current;
    Object.assign(s, {
      score: 0,
      lives: spec.rules.lives,
      level: 0,
      time: spec.rules.timeLimit,
      px: W / 2,
      py: spec.kind === "explorer" ? H / 2 : H - 60,
      things: [],
      spawnAcc: 0,
      invuln: 0,
      target: null,
      ended: false,
    });
    s.seenFacts.clear();
    if (spec.kind === "explorer") populateExplorer(0);
    setHud({ score: 0, lives: s.lives, level: 0, time: s.time });
    setQuizIdx(0);
    setPicked(null);
    setPhase("playing");
    onStart?.();
    if (spec.levels[0]) flash(spec.levels[0].name);
  };

  const levelUp = useCallback(() => {
    const s = st.current;
    const lv = spec.levels[s.level];
    if (!lv || s.score < lv.targetScore) return;
    if (s.level >= spec.levels.length - 1) return finish("won", "You beat every level!");
    s.level += 1;
    s.time = spec.rules.timeLimit;
    flash(`⬆️ ${spec.levels[s.level].name}`);
    if (spec.kind === "explorer") populateExplorer(s.level);
  }, [spec, finish, populateExplorer]);

  // Keyboard
  useEffect(() => {
    if (phase !== "playing") return;
    const down = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
      st.current.keys.add(e.key.toLowerCase());
      st.current.target = null;
    };
    const up = (e: KeyboardEvent) => st.current.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      st.current.keys.clear();
    };
  }, [phase]);

  // Main loop (catcher + explorer). Quiz is turn-based and rendered in React.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr;
    c.height = H * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    const decor = spec.theme.decorations.map((d, i) => ({ d, x: ((i * 97) % 300) + 30, y: spec.kind === "explorer" ? ((i * 151) % 360) + 80 : H - 24 - (i % 2) * 8 }));

    let raf = 0;
    let last = performance.now();
    let hudAcc = 0;
    const draw = () => {
      const s = st.current;
      const grad = g.createLinearGradient(0, 0, 0, H);
      if (spec.kind === "explorer") {
        grad.addColorStop(0, spec.theme.ground);
        grad.addColorStop(1, spec.theme.ground);
      } else {
        grad.addColorStop(0, spec.theme.sky);
        grad.addColorStop(1, spec.theme.sky + "cc");
      }
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      if (spec.kind === "explorer") {
        g.fillStyle = spec.theme.sky;
        g.fillRect(0, 0, W, 50);
      } else {
        g.fillStyle = spec.theme.ground;
        g.fillRect(0, H - 34, W, 34);
      }
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.globalAlpha = 0.55;
      g.font = "26px serif";
      for (const d of decor) g.fillText(d.d, d.x, d.y);
      g.globalAlpha = 1;
      g.font = "30px serif";
      for (const t of s.things) g.fillText(t.emoji, t.x, t.y);
      if (spec.kind !== "quiz") {
        g.globalAlpha = s.invuln > 0 && Math.floor(s.invuln * 10) % 2 ? 0.3 : 1;
        g.font = "40px serif";
        g.fillText(spec.player.emoji, s.px, s.py);
        g.globalAlpha = 1;
      }
    };

    const step = (dt: number) => {
      const s = st.current;
      if (s.ended || spec.kind === "quiz") return;
      const lv = spec.levels[s.level] ?? { spawnRate: 3, hazardSpeed: 3, targetScore: Infinity, name: "" };
      const speed = spec.player.speed * 34;
      const k = s.keys;
      let dx = (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
      let dy = spec.kind === "explorer" ? (k.has("arrowdown") || k.has("s") ? 1 : 0) - (k.has("arrowup") || k.has("w") ? 1 : 0) : 0;
      if (!dx && !dy && s.target) {
        const tx = s.target.x - s.px;
        const ty = spec.kind === "explorer" ? s.target.y - s.py : 0;
        const d = Math.hypot(tx, ty);
        if (d > 6) {
          dx = tx / d;
          dy = ty / d;
        }
      }
      s.px = Math.max(20, Math.min(W - 20, s.px + dx * speed * dt));
      if (spec.kind === "explorer") s.py = Math.max(70, Math.min(H - 20, s.py + dy * speed * dt));

      if (spec.kind === "catcher") {
        const good = spec.collectibles;
        const bad = spec.hazards;
        s.spawnAcc += dt * (0.2 + lv.spawnRate * 0.2);
        while (s.spawnAcc >= 1 && (good.length || bad.length)) {
          s.spawnAcc -= 1;
          const hazardChance = bad.length ? Math.min(0.45, bad.length / (bad.length + good.length)) : 0;
          if (good.length && Math.random() >= hazardChance) {
            const c = good[Math.floor(Math.random() * good.length)];
            s.things.push({ x: rand(20, W - 20), y: -20, vx: 0, vy: 70 + s.level * 12, emoji: c.emoji, good: true, points: c.points, name: c.name, fact: c.fact, moves: false });
          } else if (bad.length) {
            const h = bad[Math.floor(Math.random() * bad.length)];
            s.things.push({ x: rand(20, W - 20), y: -20, vx: h.moves ? rand(-40, 40) : 0, vy: 50 + lv.hazardSpeed * 22, emoji: h.emoji, good: false, points: 0, name: h.name, fact: "", moves: h.moves });
          }
        }
      }

      for (const t of s.things) {
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        if (spec.kind === "explorer" && t.moves) {
          if (t.x < 20 || t.x > W - 20) t.vx *= -1;
          if (t.y < 70 || t.y > H - 20) t.vy *= -1;
        } else if (spec.kind === "catcher" && t.moves && (t.x < 20 || t.x > W - 20)) t.vx *= -1;
      }

      s.invuln = Math.max(0, s.invuln - dt);
      const keep: Thing[] = [];
      for (const t of s.things) {
        const hit = Math.hypot(t.x - s.px, t.y - s.py) < HIT;
        if (hit && t.good) {
          s.score += t.points;
          if (t.fact && !s.seenFacts.has(t.name)) {
            s.seenFacts.add(t.name);
            showFact(`${t.emoji} ${t.fact}`);
          }
          continue;
        }
        if (hit && !t.good && s.invuln <= 0) {
          s.lives -= 1;
          s.invuln = 1.2;
          if (s.lives <= 0) {
            keep.push(t);
            s.things = keep;
            return finish("lost", `The ${t.name.toLowerCase()} got you!`);
          }
          if (spec.kind === "catcher") continue;
        }
        if (t.y < H + 30) keep.push(t);
      }
      s.things = keep;
      if (spec.kind === "explorer" && !s.things.some((t) => t.good) && s.score < lv.targetScore) {
        return finish("lost", "You collected everything, but there weren't enough points to finish the level! 🐛 That might be a bug — try the TEST tab.");
      }
      if (spec.rules.timeLimit) {
        s.time -= dt;
        if (s.time <= 0) return finish("lost", "Time's up! ⏱️");
      }
      levelUp();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (phase === "playing") {
        step(dt);
        hudAcc += dt;
        if (hudAcc > 0.1) {
          hudAcc = 0;
          const s = st.current;
          setHud({ score: s.score, lives: s.lives, level: s.level, time: Math.ceil(s.time) });
        }
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [spec, phase, finish, levelUp]);

  const pointer = (e: React.PointerEvent) => {
    if (phase !== "playing" || !canvas.current) return;
    if (e.type === "pointermove" && e.buttons === 0 && e.pointerType !== "mouse") return;
    const r = canvas.current.getBoundingClientRect();
    st.current.target = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const hold = (key: string) => ({
    onPointerDown: () => {
      st.current.target = null;
      st.current.keys.add(key);
    },
    onPointerUp: () => st.current.keys.delete(key),
    onPointerLeave: () => st.current.keys.delete(key),
    onPointerCancel: () => st.current.keys.delete(key),
  });

  // Quiz logic
  const q = spec.quiz[quizIdx];
  const answer = (i: number) => {
    if (picked !== null || !q) return;
    setPicked(i);
    const s = st.current;
    const right = i === q.answer;
    if (right) s.score += 10;
    else if (spec.rules.lives) s.lives -= 1;
    setHud((h) => ({ ...h, score: s.score, lives: s.lives }));
    if (q.explanation) showFact(`${right ? "✅" : "❌"} ${q.explanation}`);
    setTimeout(() => {
      setPicked(null);
      if (!right && spec.rules.lives && s.lives <= 0) return finish("lost", "Out of lives!");
      levelUp();
      if (st.current.ended) return;
      setHud((h) => ({ ...h, level: s.level }));
      if (quizIdx + 1 >= spec.quiz.length) {
        const final = spec.levels[spec.levels.length - 1]?.targetScore ?? 0;
        return s.score >= final ? finish("won", "Quiz complete!") : finish("lost", `Out of questions — you needed ${final} points.`);
      }
      setQuizIdx(quizIdx + 1);
    }, 1100);
  };

  const lv = spec.levels[hud.level];
  return (
    <div>
      <div className="stage" onPointerDown={pointer} onPointerMove={pointer}>
        <canvas ref={canvas} style={{ aspectRatio: `${W} / ${H}` }} />
        {phase === "playing" && (
          <div className="hud">
            <span>⭐ {hud.score}{lv ? ` / ${lv.targetScore}` : ""}</span>
            {spec.levels.length > 0 && <span>{lv?.name ?? ""}</span>}
            {spec.rules.lives > 0 && <span>{"❤️".repeat(Math.max(0, Math.min(hud.lives, 6)))}{hud.lives > 6 ? `×${hud.lives}` : ""}</span>}
            {spec.rules.timeLimit > 0 && <span>⏱️ {Math.max(0, hud.time)}</span>}
          </div>
        )}
        {phase === "playing" && spec.kind === "quiz" && q && (
          <div className="quizcard">
            <div className="q">{q.question}</div>
            {q.options.map((o, i) => (
              <button key={i} onClick={() => answer(i)} className={picked === null ? "" : i === q.answer ? "right" : i === picked ? "wrong" : ""}>
                {o}
              </button>
            ))}
          </div>
        )}
        {phase === "playing" && spec.kind === "quiz" && !q && (
          <div className="overlay">
            <h2>No questions!</h2>
            <p>This quiz has no questions yet. Add some in BUILD mode.</p>
          </div>
        )}
        {banner && phase === "playing" && <div className="banner">{banner}</div>}
        {toast && <div className="toast">{toast}</div>}
        {phase !== "playing" && (
          <div className="overlay">
            {phase === "ready" && (
              <>
                <div style={{ fontSize: "3.5rem" }}>{spec.player.emoji}</div>
                <h2>{spec.title}</h2>
                <p style={{ maxWidth: 280 }}>{spec.goal}</p>
                <button className="btn big" onClick={start}>▶ PLAY</button>
                <p className="small" style={{ opacity: 0.8 }}>
                  {spec.kind === "catcher" ? "← → keys, or drag / tap to move" : spec.kind === "explorer" ? "Arrow keys / WASD, or tap where to go" : "Tap the right answer"}
                </p>
              </>
            )}
            {(phase === "won" || phase === "lost") && (
              <>
                <div style={{ fontSize: "3.5rem" }}>{phase === "won" ? "🏆" : "💥"}</div>
                <h2>{phase === "won" ? "You win!" : "Game over"}</h2>
                <p style={{ maxWidth: 290 }}>{endReason}</p>
                <p>Score: <b>{st.current.score}</b></p>
                <button className="btn big" onClick={start}>↻ Play again</button>
              </>
            )}
          </div>
        )}
      </div>
      {phase === "playing" && spec.kind !== "quiz" && (
        <div className="pad">
          {spec.kind === "explorer" && <button aria-label="up" {...hold("arrowup")}>⬆️</button>}
          <button aria-label="left" {...hold("arrowleft")}>⬅️</button>
          {spec.kind === "explorer" && <button aria-label="down" {...hold("arrowdown")}>⬇️</button>}
          <button aria-label="right" {...hold("arrowright")}>➡️</button>
        </div>
      )}
    </div>
  );
}
