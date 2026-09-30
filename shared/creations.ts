// Images and stories. Images are "scenes": a structured picture the client renders as SVG.
// The ImageAsset union leaves room for a pixel image model later without changing callers.
import { z } from "zod";

export const SceneSpec = z.object({
  title: z.string(),
  caption: z.string(),
  style: z.enum(["space", "land", "ocean", "night", "sky", "cave"]),
  sky: z.string(),
  ground: z.string(),
  elements: z.array(
    z.object({ emoji: z.string(), label: z.string(), x: z.number(), y: z.number(), size: z.number() }),
  ),
});
export type SceneSpec = z.infer<typeof SceneSpec>;

export const StorySpec = z.object({
  title: z.string(),
  pages: z.array(z.object({ text: z.string(), emoji: z.string() })),
  moral: z.string(),
});
export type StorySpec = z.infer<typeof StorySpec>;

const hex = (v: string, fb: string) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : fb);
const n = (v: number, lo: number, hi: number, fb: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb;

export function normalizeScene(x: SceneSpec): SceneSpec {
  return {
    title: (x.title || "My Picture").slice(0, 60),
    caption: (x.caption || "").slice(0, 200),
    style: x.style,
    sky: hex(x.sky, "#1b1f4b"),
    ground: hex(x.ground, "#b5532e"),
    elements: (x.elements ?? []).slice(0, 14).map((e) => ({
      emoji: [...new Intl.Segmenter().segment(e.emoji || "✨")][0]?.segment ?? "✨",
      label: (e.label || "").slice(0, 30),
      x: Math.round(n(e.x, 0, 100, 50)),
      y: Math.round(n(e.y, 0, 100, 50)),
      size: Math.round(n(e.size, 4, 40, 12)),
    })),
  };
}

export function normalizeStory(x: StorySpec): StorySpec {
  return {
    title: (x.title || "My Story").slice(0, 60),
    pages: (x.pages ?? []).slice(0, 10).map((p) => ({ text: (p.text || "").slice(0, 600), emoji: (p.emoji || "📖").slice(0, 8) })),
    moral: (x.moral || "").slice(0, 200),
  };
}

/** A Code Mode project: real JavaScript running on the SparkForge engine. */
export const CodeSpec = z.object({ title: z.string(), emoji: z.string(), source: z.string() });
export type CodeSpec = z.infer<typeof CodeSpec>;

export function normalizeCode(x: CodeSpec): CodeSpec {
  return { title: (x.title || "My Code").slice(0, 60), emoji: (x.emoji || "⌨️").slice(0, 8), source: (x.source || "").slice(0, 60000) };
}
