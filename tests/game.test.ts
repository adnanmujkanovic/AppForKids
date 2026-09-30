import { describe, expect, it } from "vitest";
import { autoFixGame, diffGames, normalizeGame, testGame, type GameSpec } from "../shared/game";
import { autoFixApp, normalizeApp, testApp, blankBlock } from "../shared/app";
import { OfflineProvider } from "../server/ai/offline";
import type { ChildContext } from "../server/ai/types";

const ctx: ChildContext = {
  age: 10, experience: "beginner", creatorLevel: "explorer", interests: ["space"], helpLevel: "help",
  knownConcepts: [], homeworkMode: "teach", avatar: "🧒",
};
const ai = new OfflineProvider();

describe("game model", () => {
  it("offline generator produces a winnable, bug-free game for each kind", async () => {
    for (const kind of ["catcher", "explorer", "quiz"] as const) {
      const { spec } = await ai.game(ctx, { idea: "a game about Mars", kind, topicNotes: "" });
      expect(spec.kind).toBe(kind);
      const failing = testGame(spec).filter((c) => !c.passed);
      expect(failing.map((f) => f.id)).toEqual([]);
    }
  });

  it("normalize clamps out-of-range values", () => {
    const g = normalizeGame({
      title: "x".repeat(200), kind: "catcher", goal: "", theme: { sky: "red", ground: "#000000", decorations: [] },
      player: { emoji: "🚀🚀", name: "", speed: 99 }, collectibles: [], hazards: [], rules: { lives: -3, timeLimit: 9999 },
      levels: [], quiz: [],
    } as GameSpec);
    expect(g.title.length).toBe(60);
    expect(g.player.speed).toBe(10);
    expect(g.player.emoji).toBe("🚀");
    expect(g.rules.lives).toBe(0);
    expect(g.theme.sky).toMatch(/^#/);
  });

  it("detects bugs and the automatic fix resolves each one", async () => {
    const { spec } = await ai.game(ctx, { idea: "stars", kind: "catcher", topicNotes: "" });
    const broken: GameSpec[] = [
      { ...spec, player: { ...spec.player, speed: 0 } },
      { ...spec, collectibles: spec.collectibles.map((c) => ({ ...c, points: 0 })) },
      { ...spec, hazards: [], rules: { ...spec.rules, timeLimit: 0 } },
      { ...spec, rules: { ...spec.rules, timeLimit: 10 }, levels: spec.levels.map((l) => ({ ...l, targetScore: 5000 })) },
      { ...spec, levels: [...spec.levels].reverse() },
    ];
    for (const b of broken) {
      const bug = testGame(b).find((c) => !c.passed)!.bug!;
      expect(bug).toBeTruthy();
      const fixed = autoFixGame(b, bug.id);
      expect(testGame(fixed).find((c) => c.bug?.id === bug.id)).toBeUndefined();
    }
  });

  it("offline modifier understands common kid requests", async () => {
    const { spec } = await ai.game(ctx, { idea: "Mars", kind: "catcher", topicNotes: "" });
    const r = await ai.modifyGame(ctx, spec, "make the rover faster and add rocks and 2 levels");
    expect(r.understood).toBe(true);
    expect(r.spec.player.speed).toBeGreaterThan(spec.player.speed);
    expect(r.spec.levels.length).toBe(spec.levels.length + 2);
    expect(r.spec.hazards.some((h) => h.name === "Rock")).toBe(true);
    expect(diffGames(spec, r.spec).length).toBeGreaterThan(0);
    const nope = await ai.modifyGame(ctx, spec, "make it philosophical");
    expect(nope.understood).toBe(false);
  });
});

describe("app model", () => {
  it("generates an animal app that passes all tests", async () => {
    const plan = await ai.appPlan(ctx, "an app about African animals with search");
    const { spec } = await ai.app(ctx, { idea: "African animals", plan, allowAiGuide: true });
    expect(testApp(spec).every((c) => c.passed)).toBe(true);
    expect(spec.collections[0].items.length).toBeGreaterThanOrEqual(6);
  });

  it("finds and fixes a dead button", () => {
    const spec = normalizeApp({
      title: "A", description: "", theme: { color: "#123456", emoji: "📱" }, collections: [],
      screens: [{ id: "home", title: "Home", emoji: "🏠", inNav: true, blocks: [blankBlock("button", { text: "Go", goTo: "nowhere" })] }],
      startScreen: "home",
    });
    const bug = testApp(spec).find((c) => !c.passed)!.bug!;
    expect(bug.id).toBe("dead-button");
    expect(testApp(autoFixApp(spec, bug.id)).every((c) => c.passed)).toBe(true);
  });
});
