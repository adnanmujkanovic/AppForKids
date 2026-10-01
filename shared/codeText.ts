// "My Code": turns the project model into readable JavaScript-style code — the bridge from
// building blocks to real programming. Shared by the web and native apps.
import type { GameSpec } from "./game";
import type { AppSpec } from "./app";

const q = (s: string) => JSON.stringify(s);

export function gameCode(g: GameSpec): string {
  const lines = [
    `// ${g.title} — ${g.goal}`,
    `// Variables: named boxes that remember things`,
    `let score = 0;`,
    `let lives = ${g.rules.lives};`,
    `let level = 0;`,
    g.rules.timeLimit ? `let timer = ${g.rules.timeLimit}; // seconds` : `// no timer`,
    ``,
    `// Data: the player, things to collect, and dangers`,
    `const player = { emoji: ${q(g.player.emoji)}, speed: ${g.player.speed} };`,
    `const collectibles = [`,
    ...g.collectibles.map((c) => `  { emoji: ${q(c.emoji)}, name: ${q(c.name)}, points: ${c.points} },`),
    `];`,
    `const dangers = [${g.hazards.map((h) => `${q(h.emoji)}`).join(", ")}];`,
    `const levels = [`,
    ...g.levels.map((l) => `  { name: ${q(l.name)}, target: ${l.targetScore}, spawnRate: ${l.spawnRate}, dangerSpeed: ${l.hazardSpeed} },`),
    `];`,
    ``,
  ];
  if (g.kind === "quiz") {
    lines.push(
      `// Loop: ask every question in the list`,
      `for (const question of quiz) {  // ${g.quiz.length} questions`,
      `  const answer = ask(question);`,
      `  if (answer === question.correct) {`,
      `    score = score + 10;`,
      `  } else {`,
      g.rules.lives ? `    lives = lives - 1;` : `    // no penalty`,
      `  }`,
      g.rules.lives ? `  if (lives === 0) return gameOver();` : ``,
      `  if (score >= levels[level].target) level = level + 1;`,
      `}`,
    );
  } else {
    lines.push(
      `// The game loop runs about 60 times every second`,
      `function everyFrame() {`,
      `  // Movement: position changes by speed`,
      g.kind === "catcher"
        ? `  if (leftPressed) player.x = player.x - player.speed;\n  if (rightPressed) player.x = player.x + player.speed;`
        : `  player.x = player.x + direction.x * player.speed;\n  player.y = player.y + direction.y * player.speed;`,
      ``,
      `  // Events: what happens when things touch (collisions)`,
      `  for (const thing of thingsOnScreen) {`,
      `    if (touching(player, thing)) {`,
      `      if (collectibles.includes(thing)) score = score + thing.points;`,
      `      if (dangers.includes(thing)) lives = lives - 1;`,
      `    }`,
      `  }`,
      ``,
      `  // Conditions: IF something is true, THEN do something`,
      `  if (lives === 0) gameOver();`,
      g.rules.timeLimit ? `  if (timer === 0) gameOver(); // time's up` : ``,
      `  if (score >= levels[level].target) {`,
      `    if (level === levels.length - 1) youWin();`,
      `    else level = level + 1;`,
      `  }`,
      `}`,
    );
  }
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

export function appCode(a: AppSpec): string {
  const lines = [
    `// ${a.title}`,
    `// Data: collections of items your app shows`,
    ...a.collections.map((c) => `const ${c.name.replace(/[^a-zA-Z0-9_]/g, "_")} = [ /* ${c.items.length} items */ ${c.items.slice(0, 2).map((i) => q(i.title)).join(", ")}${c.items.length > 2 ? ", …" : ""} ];`),
    ``,
    `// Components: each screen is built from blocks`,
  ];
  for (const s of a.screens) {
    lines.push(`function ${s.id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()).replace(/[^a-zA-Z0-9_]/g, "")}Screen() {`, `  return (`, `    <Screen title=${q(s.title)}>`);
    for (const b of s.blocks) {
      switch (b.type) {
        case "heading": lines.push(`      <Heading>${b.text}</Heading>`); break;
        case "text": lines.push(`      <Text>${b.text}</Text>`); break;
        case "image": lines.push(`      <Picture emoji=${q(b.emoji)} />`); break;
        case "card": lines.push(`      <Card emoji=${q(b.emoji)} text=${q(b.text)} />`); break;
        case "button": lines.push(`      <Button onTap={() => goTo(${q(b.goTo)})}>${b.text}</Button>`); break;
        case "list": lines.push(`      <List data={${b.collection || "nothing"}} onTap={(item) => { selected = item; goTo(${q(b.goTo)}); }} />`); break;
        case "search": lines.push(`      <Search filters={${b.collection || "nothing"}} />`); break;
        case "input": lines.push(`      <Input label=${q(b.text)} saveTo="${b.variable || "?"}" />`); break;
        case "facts": lines.push(`      <Facts of={selected} />`); break;
        case "aiGuide": lines.push(`      <AIGuide persona=${q(b.text)} /> {/* sends questions to an AI model */}`); break;
      }
    }
    lines.push(`    </Screen>`, `  );`, `}`, ``);
  }
  lines.push(`// Navigation: the app starts here`, `start(${q(a.startScreen)});`);
  return lines.join("\n");
}

