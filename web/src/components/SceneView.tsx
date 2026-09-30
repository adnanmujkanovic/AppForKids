// Renders an AI-composed scene as vector art. In edit mode, elements can be dragged.
import { useRef, useState } from "react";
import type { SceneSpec } from "../../../shared/creations";

const W = 400;
const H = 300;

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `#${((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, "0")}`;
}

// Deterministic "random" so stars don't jump between renders.
const rand = (i: number) => {
  const x = Math.sin(i * 999) * 10000;
  return x - Math.floor(x);
};

export function SceneView({ scene, onChange, showLabels = true }: { scene: SceneSpec; onChange?: (s: SceneSpec) => void; showLabels?: boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const groundY = scene.style === "ocean" ? H * 0.85 : scene.style === "space" ? H * 0.8 : H * 0.65;
  const id = `g${scene.sky.slice(1)}${scene.style}`;

  const move = (e: React.PointerEvent) => {
    if (drag === null || !onChange || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100);
    const y = Math.round(((e.clientY - r.top) / r.height) * 100);
    const elements = scene.elements.map((el, i) => (i === drag ? { ...el, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : el));
    onChange({ ...scene, elements });
  };

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={scene.caption || scene.title}
      onPointerMove={move}
      onPointerUp={() => setDrag(null)}
      onPointerLeave={() => setDrag(null)}
      style={{ touchAction: onChange ? "none" : "auto" }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(scene.sky, -30)} />
          <stop offset="1" stopColor={shade(scene.sky, 30)} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
      {(scene.style === "space" || scene.style === "night") &&
        Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={rand(i) * W} cy={rand(i + 50) * groundY} r={rand(i + 99) * 1.6 + 0.4} fill="#fff" opacity={0.4 + rand(i + 7) * 0.6} />
        ))}
      {scene.style === "ocean" &&
        Array.from({ length: 14 }, (_, i) => (
          <circle key={i} cx={rand(i) * W} cy={rand(i + 30) * groundY} r={2 + rand(i + 9) * 5} fill="none" stroke="#fff" opacity={0.35} />
        ))}
      {scene.style === "sky" &&
        [0, 1, 2].map((i) => <ellipse key={i} cx={60 + i * 130} cy={50 + (i % 2) * 30} rx={45} ry={16} fill="#fff" opacity={0.8} />)}
      {scene.style === "cave" && <path d={`M0 0 H${W} V60 Q${W * 0.75} 110 ${W / 2} 70 Q${W / 4} 30 0 90 Z`} fill={shade(scene.ground, -40)} />}
      <path
        d={`M0 ${groundY} Q ${W * 0.25} ${groundY - 18} ${W * 0.5} ${groundY} T ${W} ${groundY} V ${H} H 0 Z`}
        fill={scene.ground}
      />
      <path d={`M0 ${groundY + 18} Q ${W * 0.3} ${groundY + 6} ${W * 0.6} ${groundY + 20} T ${W} ${groundY + 14} V ${H} H 0 Z`} fill={shade(scene.ground, -18)} />
      {scene.elements.map((el, i) => {
        const x = (el.x / 100) * W;
        const y = (el.y / 100) * H;
        const size = el.size * 2.2;
        return (
          <g
            key={i}
            onPointerDown={(e) => {
              if (!onChange) return;
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setDrag(i);
            }}
            style={{ cursor: onChange ? "grab" : "default" }}
          >
            <text x={x} y={y} fontSize={size} textAnchor="middle" dominantBaseline="middle">
              {el.emoji}
            </text>
            {showLabels && el.label && (
              <text x={x} y={y + size * 0.62 + 6} fontSize={9} fontWeight={800} textAnchor="middle" fill="#fff" stroke="rgba(0,0,0,0.45)" strokeWidth={2.5} paintOrder="stroke">
                {el.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
