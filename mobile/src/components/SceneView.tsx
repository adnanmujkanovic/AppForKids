// Native vector rendering of an AI-composed scene. In edit mode: tap something to pick it,
// then tap anywhere in the picture to move it there.
import { useState } from "react";
import { Pressable, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from "react-native-svg";
import type { SceneSpec } from "../../../shared/creations";

const W = 400;
const H = 300;

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `#${((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, "0")}`;
}
const rand = (i: number) => {
  const x = Math.sin(i * 999) * 10000;
  return x - Math.floor(x);
};

export function SceneView({ scene, onChange, selected, onSelect }: { scene: SceneSpec; onChange?: (s: SceneSpec) => void; selected?: number | null; onSelect?: (i: number | null) => void }) {
  const [width, setWidth] = useState(0);
  const groundY = scene.style === "ocean" ? H * 0.85 : scene.style === "space" ? H * 0.8 : H * 0.65;
  const place = (e: GestureResponderEvent) => {
    if (!onChange || selected == null || !width) return;
    const scale = width / W;
    const x = Math.round((e.nativeEvent.locationX / scale / W) * 100);
    const y = Math.round((e.nativeEvent.locationY / scale / H) * 100);
    onChange({ ...scene, elements: scene.elements.map((el, i) => (i === selected ? { ...el, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : el)) });
  };
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ width: "100%", aspectRatio: W / H, borderRadius: 18, overflow: "hidden" }}>
      <Pressable onPress={place} disabled={!onChange} style={{ flex: 1 }} accessibilityLabel={scene.caption || scene.title}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
          {/* Sky in bands (renders identically on iOS, Android and web, unlike SVG gradients). */}
          {Array.from({ length: 6 }, (_, i) => (
            <Rect key={i} y={(i * H) / 6} width={W} height={H / 6 + 1} fill={shade(scene.sky, -30 + i * 12)} />
          ))}
          {(scene.style === "space" || scene.style === "night") &&
            Array.from({ length: 40 }, (_, i) => <Circle key={i} cx={rand(i) * W} cy={rand(i + 50) * groundY} r={rand(i + 99) * 1.6 + 0.4} fill="#fff" opacity={0.4 + rand(i + 7) * 0.6} />)}
          {scene.style === "ocean" &&
            Array.from({ length: 14 }, (_, i) => <Circle key={i} cx={rand(i) * W} cy={rand(i + 30) * groundY} r={2 + rand(i + 9) * 5} fill="none" stroke="#fff" opacity={0.35} />)}
          {scene.style === "sky" && [0, 1, 2].map((i) => <Ellipse key={i} cx={60 + i * 130} cy={50 + (i % 2) * 30} rx={45} ry={16} fill="#fff" opacity={0.8} />)}
          {scene.style === "cave" && <Path d={`M0 0 H${W} V60 Q${W * 0.75} 110 ${W / 2} 70 Q${W / 4} 30 0 90 Z`} fill={shade(scene.ground, -40)} />}
          <Path d={`M0 ${groundY} Q ${W * 0.25} ${groundY - 18} ${W * 0.5} ${groundY} T ${W} ${groundY} V ${H} H 0 Z`} fill={scene.ground} />
          <Path d={`M0 ${groundY + 18} Q ${W * 0.3} ${groundY + 6} ${W * 0.6} ${groundY + 20} T ${W} ${groundY + 14} V ${H} H 0 Z`} fill={shade(scene.ground, -18)} />
          {scene.elements.map((el, i) => {
            const x = (el.x / 100) * W;
            const y = (el.y / 100) * H;
            const size = el.size * 2.2;
            return (
              <G key={i} onPress={onSelect ? () => onSelect(selected === i ? null : i) : undefined}>
                {selected === i && <Circle cx={x} cy={y} r={size * 0.7} fill="none" stroke="#fff" strokeWidth={3} strokeDasharray="6 4" />}
                <SvgText x={x} y={y + size * 0.35} fontSize={size} textAnchor="middle">
                  {el.emoji}
                </SvgText>
                {el.label ? (
                  <>
                    <SvgText x={x + 0.8} y={y + size * 0.62 + 8.8} fontSize={10} fontWeight="800" textAnchor="middle" fill="rgba(0,0,0,0.55)">
                      {el.label}
                    </SvgText>
                    <SvgText x={x} y={y + size * 0.62 + 8} fontSize={10} fontWeight="800" textAnchor="middle" fill="#fff">
                      {el.label}
                    </SvgText>
                  </>
                ) : null}
              </G>
            );
          })}
        </Svg>
      </Pressable>
    </View>
  );
}
