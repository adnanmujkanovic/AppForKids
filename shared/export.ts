// Turns projects into real code and standalone web pages (Code Mode, download, deploy).
import type { GameSpec } from "./game";
import type { AppSpec } from "./app";

/** Generate editable JavaScript from a game: the default rules become code the child can change. */
export function ejectGame(spec: GameSpec): string {
  const config = JSON.stringify(spec, null, 2);
  const quiz = spec.kind === "quiz";
  return `// ${spec.title} — written in real JavaScript!
// Change anything below, then press ▶ Run. Try:
//   • make stars worth double points
//   • give the player an extra life every level
//   • say something funny when you get hit

const game = createGame(${config});

${quiz ? `// When the player answers a question:
game.onAnswer(({ correct, question }) => {
  if (correct) {
    game.score = game.score + 10;
  } else {
    game.lives = game.lives - 1;
  }
});` : `// When the player touches something to collect:
game.onCollect((thing) => {
  game.score = game.score + thing.points;
  if (thing.fact) {
    game.say(thing.emoji + " " + thing.fact);
  }
});

// When the player bumps into a danger:
game.onHit((danger) => {
  game.lives = game.lives - 1;
  if (game.lives <= 0) {
    game.over("The " + danger.name + " got you!");
  }
});

// Runs about 60 times every second:
game.onFrame(() => {
  if (game.score >= game.target()) {
    game.nextLevel();
  }
});`}

// When a new level starts:
game.onLevel((level) => {
  game.say("Level " + (level + 1) + ": " + game.levelName());
});

game.start();
`;
}

const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'";

const safeScript = (js: string) => js.replace(/<\/(script)/gi, "<\\/$1");
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function pageStart(title: string, head: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>${escapeHtml(title)}</title>
<style>body{margin:0;padding:16px;background:#f8f5ff;font-family:system-ui,sans-serif;color:#1d1b2e}footer{text-align:center;color:#8a87a3;font-size:12px;margin-top:14px}</style>
${head}
</head>
<body>
`;
}
const pageEnd = "</body>\n</html>\n";

/**
 * A standalone page that runs child-written code on the SparkForge engine.
 * `lineOffset` maps browser error line numbers back to the child's code.
 */
export function codeHtml(engineJs: string, title: string, source: string, credit = "Made with SparkForge Kids") {
  const before = `${pageStart(title, `<script>${safeScript(engineJs)}</script>`)}<div id="game"></div>
<footer>${escapeHtml(credit)}</footer>
<script>
`;
  return { html: `${before}${safeScript(source)}\n</script>\n${pageEnd}`, lineOffset: before.split("\n").length - 1 };
}

export function gameHtml(engineJs: string, spec: GameSpec, credit?: string) {
  return codeHtml(engineJs, spec.title, ejectGame(spec), credit).html;
}

export function appHtml(appJs: string, spec: AppSpec, credit = "Made with SparkForge Kids") {
  return `${pageStart(spec.title, `<style>body{padding:0}</style><script>${safeScript(appJs)}</script>`)}<div id="app"></div>
<footer>${escapeHtml(credit)}</footer>
<script>renderApp(${safeScript(JSON.stringify(spec))});</script>
${pageEnd}`;
}
