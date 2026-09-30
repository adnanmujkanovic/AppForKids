// The constrained game model. AI produces this structured data; the runtime renders it.
// Nothing in here is executable code, which keeps generated games safe and debuggable.
import { z } from "zod";

export const GAME_KINDS = ["catcher", "explorer", "quiz"] as const;
export type GameKind = (typeof GAME_KINDS)[number];

export const GAME_KIND_INFO: Record<GameKind, { label: string; emoji: string; verb: string }> = {
  catcher: { label: "Catcher", emoji: "🧺", verb: "Catch falling things and dodge the dangerous ones" },
  explorer: { label: "Explorer", emoji: "🧭", verb: "Move around a world and collect treasures" },
  quiz: { label: "Quiz", emoji: "❓", verb: "Answer questions to score points" },
};

// Loose schema: what we accept from AI or from the child's edits. Normalize() clamps it.
export const GameSpecInput = z.object({
  title: z.string(),
  kind: z.enum(GAME_KINDS),
  goal: z.string(),
  theme: z.object({
    sky: z.string(),
    ground: z.string(),
    decorations: z.array(z.string()),
  }),
  player: z.object({ emoji: z.string(), name: z.string(), speed: z.number() }),
  collectibles: z.array(
    z.object({ emoji: z.string(), name: z.string(), points: z.number(), fact: z.string() }),
  ),
  hazards: z.array(z.object({ emoji: z.string(), name: z.string(), moves: z.boolean() })),
  rules: z.object({ lives: z.number(), timeLimit: z.number() }),
  levels: z.array(
    z.object({ name: z.string(), targetScore: z.number(), spawnRate: z.number(), hazardSpeed: z.number() }),
  ),
  quiz: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      answer: z.number(),
      explanation: z.string(),
    }),
  ),
});
export type GameSpec = z.infer<typeof GameSpecInput>;

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(hi, Math.max(lo, Math.round(v)));
};
const str = (s: unknown, max: number, fallback = "") =>
  (typeof s === "string" ? s : fallback).slice(0, max);
const firstGrapheme = (s: string, fallback: string) => {
  const seg = [...new Intl.Segmenter().segment(s.trim())][0]?.segment;
  return seg || fallback;
};

/** Clamp every value into a range the runtime can handle. Never throws on shape-valid input. */
export function normalizeGame(input: GameSpec): GameSpec {
  const kind = GAME_KINDS.includes(input.kind) ? input.kind : "catcher";
  const levels = (input.levels ?? []).slice(0, 10).map((l, i) => ({
    name: str(l.name, 40, `Level ${i + 1}`) || `Level ${i + 1}`,
    targetScore: clamp(l.targetScore, 0, 100000, 10 * (i + 1)),
    spawnRate: clamp(l.spawnRate, 1, 10, 3 + i),
    hazardSpeed: clamp(l.hazardSpeed, 1, 10, 3 + i),
  }));
  return {
    title: str(input.title, 60, "My Game") || "My Game",
    kind,
    goal: str(input.goal, 200),
    theme: {
      sky: /^#[0-9a-fA-F]{6}$/.test(input.theme?.sky ?? "") ? input.theme.sky : "#1b1f4b",
      ground: /^#[0-9a-fA-F]{6}$/.test(input.theme?.ground ?? "") ? input.theme.ground : "#8a4b2a",
      decorations: (input.theme?.decorations ?? []).slice(0, 8).map((d) => firstGrapheme(d, "✨")),
    },
    player: {
      emoji: firstGrapheme(input.player?.emoji ?? "", "🙂"),
      name: str(input.player?.name, 40, "Player") || "Player",
      speed: clamp(input.player?.speed, 0, 10, 5),
    },
    collectibles: (input.collectibles ?? []).slice(0, 8).map((c) => ({
      emoji: firstGrapheme(c.emoji, "⭐"),
      name: str(c.name, 40, "Star"),
      points: clamp(c.points, -100, 100, 1),
      fact: str(c.fact, 240),
    })),
    hazards: (input.hazards ?? []).slice(0, 6).map((h) => ({
      emoji: firstGrapheme(h.emoji, "🪨"),
      name: str(h.name, 40, "Rock"),
      moves: !!h.moves,
    })),
    rules: {
      lives: clamp(input.rules?.lives, 0, 10, 3),
      timeLimit: clamp(input.rules?.timeLimit, 0, 600, 0),
    },
    levels,
    quiz: (input.quiz ?? []).slice(0, 20).map((q) => {
      const options = (q.options ?? []).slice(0, 4).map((o) => str(o, 80));
      return {
        question: str(q.question, 200),
        options,
        answer: clamp(q.answer, 0, Math.max(0, options.length - 1), 0),
        explanation: str(q.explanation, 240),
      };
    }),
  };
}

// ---------- Testing & debugging ----------

export interface GameCheck {
  id: string;
  question: string; // "Can the player win?"
  passed: boolean;
  bug?: GameBug;
}

export interface GameBug {
  id: string;
  title: string; // "🐛 Nobody can win this game"
  explanation: string; // why it happens
  hint: string; // nudge without the answer
  where: string; // which part of the game model to look at (build-mode field path)
  concept: string; // engineering concept this bug teaches
}

/** Average points the player can realistically earn per second in a catcher/explorer level. */
function pointsPerSecond(spec: GameSpec, level: GameSpec["levels"][number]): number {
  const positives = spec.collectibles.filter((c) => c.points > 0);
  if (!positives.length) return 0;
  const avg = positives.reduce((s, c) => s + c.points, 0) / positives.length;
  // Spawn rate 1..10 roughly maps to 0.4..2.2 items per second; players catch ~60%.
  const itemsPerSecond = 0.2 + level.spawnRate * 0.2;
  const hazardShare = spec.hazards.length / (spec.hazards.length + positives.length);
  return avg * itemsPerSecond * (1 - hazardShare) * 0.6;
}

/** Static play-test. Each failing check is a real bug a child can investigate and fix. */
export function testGame(spec: GameSpec): GameCheck[] {
  const checks: GameCheck[] = [];
  const add = (id: string, question: string, bug: GameBug | null) =>
    checks.push({ id, question, passed: !bug, ...(bug ? { bug } : {}) });

  add(
    "can-start",
    "Can the player start and move?",
    spec.kind !== "quiz" && spec.player.speed <= 0
      ? {
          id: "player-frozen",
          title: `🐛 ${spec.player.name} can't move`,
          explanation: `The player's speed variable is 0, so every time the game adds speed to the position, nothing changes.`,
          hint: "Look at the number that controls how fast the player moves.",
          where: "player.speed",
          concept: "Variables",
        }
      : null,
  );

  if (spec.kind === "quiz") {
    add(
      "has-questions",
      "Does the quiz have questions?",
      spec.quiz.length === 0
        ? {
            id: "no-questions",
            title: "🐛 The quiz is empty",
            explanation: "The game loops over the list of questions, but the list has nothing in it — so it ends right away.",
            hint: "A quiz needs something to ask!",
            where: "quiz",
            concept: "Data",
          }
        : null,
    );
    const broken = spec.quiz.findIndex((q) => q.options.length < 2 || q.answer >= q.options.length);
    add(
      "answers-valid",
      "Does every question have a right answer?",
      broken >= 0
        ? {
            id: "bad-answer",
            title: `🐛 Question ${broken + 1} can't be answered correctly`,
            explanation: "The correct answer points to an option that doesn't exist, or there are fewer than two options.",
            hint: `Check the options for question ${broken + 1}.`,
            where: `quiz.${broken}`,
            concept: "Conditions",
          }
        : null,
    );
    const maxScore = spec.quiz.length * 10;
    const needed = spec.levels[spec.levels.length - 1]?.targetScore ?? 0;
    add(
      "can-win",
      "Can the player win?",
      spec.levels.length && needed > maxScore
        ? {
            id: "quiz-unwinnable",
            title: "🐛 Nobody can win this quiz",
            explanation: `Each right answer gives 10 points, and there are ${spec.quiz.length} questions — that's at most ${maxScore} points. But the last level needs ${needed}.`,
            hint: "Compare the target score with how many points you can possibly get.",
            where: "levels",
            concept: "Conditions",
          }
        : null,
    );
  } else {
    const scoring = spec.collectibles.some((c) => c.points > 0);
    add(
      "score-works",
      "Does the score go up?",
      !scoring
        ? {
            id: "no-points",
            title: "🐛 The score never goes up",
            explanation: "None of the things you collect give positive points, so the score variable can never increase.",
            hint: "Look at how many points each collectible gives.",
            where: "collectibles",
            concept: "Variables",
          }
        : null,
    );
    add(
      "has-levels",
      "Is there a finish line?",
      spec.levels.length === 0
        ? {
            id: "no-levels",
            title: "🐛 The game never ends",
            explanation: "There are no levels, so there is no target score and the game can't tell when you've won.",
            hint: "Games need a goal. Where is the target score stored?",
            where: "levels",
            concept: "Conditions",
          }
        : null,
    );
    if (spec.kind === "explorer") {
      // Explorer levels place a fixed number of collectibles, so check the target is reachable.
      const worst = spec.levels.findIndex((l) => {
        const itemsOnMap = 4 + l.spawnRate * 2;
        const best = Math.max(0, ...spec.collectibles.map((c) => c.points));
        return l.targetScore > itemsOnMap * best;
      });
      add(
        "can-win",
        "Can the player win?",
        scoring && worst >= 0
          ? {
              id: "explorer-unwinnable",
              title: `🐛 ${spec.levels[worst].name} can't be finished`,
              explanation: `That level only places ${4 + spec.levels[worst].spawnRate * 2} treasures on the map, but it needs ${spec.levels[worst].targetScore} points.`,
              hint: "How many treasures are on the map, and how many points do you need?",
              where: `levels.${worst}`,
              concept: "Conditions",
            }
          : null,
      );
    } else {
      const impossible = spec.levels.findIndex((l) => {
        if (!spec.rules.timeLimit) return false;
        return pointsPerSecond(spec, l) * spec.rules.timeLimit < l.targetScore;
      });
      add(
        "can-win",
        "Can the player win in time?",
        scoring && impossible >= 0
          ? {
              id: "time-too-short",
              title: `🐛 ${spec.levels[impossible].name} is impossible in time`,
              explanation: `With a ${spec.rules.timeLimit}-second timer, a great player can score about ${Math.round(
                pointsPerSecond(spec, spec.levels[impossible]) * spec.rules.timeLimit,
              )} points — but the level needs ${spec.levels[impossible].targetScore}.`,
              hint: "Three numbers matter here: the timer, the target score and how many points things give.",
              where: `levels.${impossible}`,
              concept: "Timers",
            }
          : null,
      );
    }
    add(
      "can-lose",
      "Can the player lose?",
      spec.hazards.length === 0 && !spec.rules.timeLimit
        ? {
            id: "cant-lose",
            title: "🐛 It's impossible to lose",
            explanation: "There are no dangers and no timer, so nothing can ever end the game. That makes it less exciting!",
            hint: "What could make the player lose a life?",
            where: "hazards",
            concept: "Game Design",
          }
        : null,
    );
    add(
      "has-lives",
      "Does the player have lives?",
      spec.hazards.length > 0 && spec.rules.lives === 0
        ? {
            id: "zero-lives",
            title: "🐛 The game is over before it starts",
            explanation: "Lives start at 0, so the very first bump ends the game.",
            hint: "Check the variable that counts lives.",
            where: "rules.lives",
            concept: "Variables",
          }
        : null,
    );
  }

  const decreasing = spec.levels.findIndex((l, i) => i > 0 && l.targetScore < spec.levels[i - 1].targetScore);
  add(
    "levels-grow",
    "Do levels get harder?",
    decreasing > 0
      ? {
          id: "levels-shrink",
          title: `🐛 ${spec.levels[decreasing].name} finishes instantly`,
          explanation: `Its target score (${spec.levels[decreasing].targetScore}) is lower than the level before it, and the score keeps counting up — so it is already reached when the level starts.`,
          hint: "Look at the target score of each level, in order.",
          where: `levels.${decreasing}`,
          concept: "Loops",
        }
      : null,
  );
  return checks;
}

/** One-click fix for a bug detected by testGame(). */
export function autoFixGame(spec: GameSpec, bugId: string): GameSpec {
  const s: GameSpec = structuredClone(spec);
  switch (bugId) {
    case "player-frozen":
      s.player.speed = 5;
      break;
    case "no-questions":
      s.quiz = [
        { question: "Is this quiz fixed now?", options: ["Yes!", "No"], answer: 0, explanation: "You found and fixed the bug." },
      ];
      break;
    case "bad-answer":
      s.quiz = s.quiz.map((q) => {
        const options = q.options.length >= 2 ? q.options : [...q.options, "Yes", "No"].slice(0, Math.max(2, q.options.length));
        return { ...q, options, answer: Math.min(q.answer, options.length - 1) };
      });
      break;
    case "quiz-unwinnable":
      s.levels = s.levels.map((l, i) => ({
        ...l,
        targetScore: Math.min(l.targetScore, Math.round((s.quiz.length * 10 * (i + 1)) / s.levels.length)),
      }));
      break;
    case "no-points":
      if (!s.collectibles.length) s.collectibles.push({ emoji: "⭐", name: "Star", points: 1, fact: "" });
      s.collectibles = s.collectibles.map((c) => ({ ...c, points: Math.max(1, Math.abs(c.points)) }));
      break;
    case "no-levels":
      s.levels = [{ name: "Level 1", targetScore: 10, spawnRate: 3, hazardSpeed: 3 }];
      break;
    case "explorer-unwinnable": {
      const best = Math.max(1, ...s.collectibles.map((c) => c.points));
      s.levels = s.levels.map((l) => ({ ...l, targetScore: Math.min(l.targetScore, (4 + l.spawnRate * 2) * best) }));
      break;
    }
    case "time-too-short":
      s.levels = s.levels.map((l) => {
        const reachable = Math.floor(pointsPerSecond(s, l) * s.rules.timeLimit * 0.8);
        return { ...l, targetScore: Math.max(1, Math.min(l.targetScore, reachable)) };
      });
      break;
    case "cant-lose":
      s.hazards.push({ emoji: "🪨", name: "Rock", moves: false });
      if (!s.rules.lives) s.rules.lives = 3;
      break;
    case "zero-lives":
      s.rules.lives = 3;
      break;
    case "levels-shrink":
      for (let i = 1; i < s.levels.length; i++) {
        if (s.levels[i].targetScore <= s.levels[i - 1].targetScore) {
          s.levels[i].targetScore = s.levels[i - 1].targetScore + 10;
        }
      }
      break;
  }
  return normalizeGame(s);
}

/** Engineering concepts a game uses — surfaced contextually, never as a curriculum. */
export function gameConcepts(spec: GameSpec): string[] {
  const c = new Set<string>(["Game Design", "Variables"]);
  if (spec.kind !== "quiz") c.add("Movement").add("Collisions").add("Events");
  if (spec.levels.length > 1) c.add("Loops");
  if (spec.rules.lives || spec.rules.timeLimit || spec.levels.length) c.add("Conditions");
  if (spec.rules.timeLimit) c.add("Timers");
  if (spec.collectibles.some((x) => x.fact) || spec.quiz.length) c.add("Data");
  return [...c];
}

/** Human-readable description of what changed between two versions. */
export function diffGames(a: GameSpec, b: GameSpec): string[] {
  const out: string[] = [];
  if (a.title !== b.title) out.push(`Renamed to “${b.title}”`);
  if (a.kind !== b.kind) out.push(`Changed game type to ${GAME_KIND_INFO[b.kind].label}`);
  if (a.player.speed !== b.player.speed) out.push(`Player speed ${a.player.speed} → ${b.player.speed}`);
  if (a.player.emoji !== b.player.emoji || a.player.name !== b.player.name)
    out.push(`Player is now ${b.player.emoji} ${b.player.name}`);
  const names = (xs: { name: string }[]) => new Set(xs.map((x) => x.name));
  for (const x of b.collectibles) if (!names(a.collectibles).has(x.name)) out.push(`Added ${x.emoji} ${x.name}`);
  for (const x of a.collectibles) if (!names(b.collectibles).has(x.name)) out.push(`Removed ${x.emoji} ${x.name}`);
  for (const x of b.hazards) if (!names(a.hazards).has(x.name)) out.push(`Added danger ${x.emoji} ${x.name}`);
  for (const x of a.hazards) if (!names(b.hazards).has(x.name)) out.push(`Removed danger ${x.emoji} ${x.name}`);
  if (a.levels.length !== b.levels.length) out.push(`Levels ${a.levels.length} → ${b.levels.length}`);
  else if (JSON.stringify(a.levels) !== JSON.stringify(b.levels)) out.push("Tuned the levels");
  if (a.rules.lives !== b.rules.lives) out.push(`Lives ${a.rules.lives} → ${b.rules.lives}`);
  if (a.rules.timeLimit !== b.rules.timeLimit) out.push(`Timer ${a.rules.timeLimit || "off"} → ${b.rules.timeLimit || "off"}`);
  if (a.quiz.length !== b.quiz.length) out.push(`Questions ${a.quiz.length} → ${b.quiz.length}`);
  if (JSON.stringify(a.theme) !== JSON.stringify(b.theme)) out.push("Changed the look");
  return out;
}
