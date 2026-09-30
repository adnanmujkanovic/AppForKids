// Builds standalone web pages from projects (download, GitHub Pages).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appHtml, codeHtml, gameHtml } from "../../shared/export";
import type { GameSpec } from "../../shared/game";
import type { AppSpec } from "../../shared/app";
import type { CodeSpec } from "../../shared/creations";
import type { Project } from "../../shared/types";

let cache: { engine: string; app: string } | null = null;
export function runtimes() {
  cache ??= {
    engine: readFileSync(resolve("shared/runtime/engine.js"), "utf8"),
    app: readFileSync(resolve("shared/runtime/app.js"), "utf8"),
  };
  return cache;
}

export const EXPORTABLE = new Set(["game", "app", "code"]);

export function projectHtml(p: Project, creator: string): string | null {
  const credit = `Made by ${creator} with SparkForge Kids`;
  const r = runtimes();
  if (p.type === "game") return gameHtml(r.engine, p.spec as GameSpec, credit);
  if (p.type === "code") {
    const c = p.spec as CodeSpec;
    return codeHtml(r.engine, c.title, c.source, credit).html;
  }
  if (p.type === "app") return appHtml(r.app, p.spec as AppSpec, credit);
  return null;
}

export const STARTER_CODE = `// ⌨️ My code game!
// This is real JavaScript. Change something, then press ▶ Run.

const game = createGame({
  title: "Star Catcher",
  kind: "catcher", // try "explorer" or "quiz"
  goal: "Catch the stars and dodge the meteors!",
  theme: { sky: "#0b1033", ground: "#2a2f5c", decorations: ["✨", "🌟"] },
  player: { emoji: "🚀", name: "Rocket", speed: 6 },
  collectibles: [{ emoji: "⭐", name: "Star", points: 1, fact: "" }],
  hazards: [{ emoji: "☄️", name: "Meteor", moves: false }],
  rules: { lives: 3, timeLimit: 0 },
  levels: [
    { name: "Level 1", targetScore: 10, spawnRate: 3, hazardSpeed: 3 },
    { name: "Level 2", targetScore: 25, spawnRate: 5, hazardSpeed: 5 },
  ],
  quiz: [],
});

// A variable of my own: how many stars I caught in a row
let streak = 0;

game.onCollect((thing) => {
  streak = streak + 1;
  game.score = game.score + thing.points;
  if (streak === 5) {
    game.say("🔥 5 in a row! Bonus points!");
    game.score = game.score + 5;
    streak = 0;
  }
});

game.onHit((danger) => {
  streak = 0;
  game.lives = game.lives - 1;
  if (game.lives <= 0) {
    game.over("The " + danger.name + " got you!");
  }
});

game.onFrame(() => {
  if (game.score >= game.target()) {
    game.nextLevel();
  }
});

game.start();
`;
