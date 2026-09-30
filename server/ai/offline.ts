// Offline provider: deterministic, rule-based stand-in for a model. It keeps every product
// flow working without network or API keys, and is honest in the UI that it's "practice mode".
import type { AIProvider, AppPlan, ChatReply, ChatRequest, ChildContext, DetectiveCase, Modification, Suggestion } from "./types";
import { GAME_KIND_INFO, type GameKind, type GameSpec, normalizeGame } from "../../shared/game";
import { type AppSpec, blankBlock, normalizeApp } from "../../shared/app";
import { normalizeScene, normalizeStory, type SceneSpec, type StorySpec } from "../../shared/creations";
import { capitalize, DANGER_WORDS, emojiFor, EMOJI, findTopic, TOPICS, type Topic } from "./knowledge";

const words = (s: string) => s.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g) ?? [];

const GENERIC: Topic = {
  ...TOPICS[1],
  id: "generic",
  label: "Adventure",
  emoji: "✨",
  keywords: [],
  sky: "#2b2d6e",
  ground: "#3f7d5a",
  style: "land",
  decorations: ["🌳", "☁️", "🌸"],
  player: { emoji: "🧒", name: "Hero" },
  collectibles: [
    { emoji: "⭐", name: "Star", fact: "" },
    { emoji: "🪙", name: "Coin", fact: "" },
    { emoji: "💎", name: "Gem", fact: "" },
  ],
  hazards: [{ emoji: "🪨", name: "Rock", moves: false }],
};

const SELF_WORDS = new Set(["me", "kid"]);

const APP_COLORS: Record<string, string> = {
  mars: "#c2410c", space: "#4338ca", volcanoes: "#b91c1c", animals: "#a15c07", ocean: "#0e7490", dinosaurs: "#3f7d20", robots: "#334155",
};

/** Nouns in the prompt that we can draw, e.g. "a cat on the moon" -> [cat, moon]. */
function drawableNouns(text: string): string[] {
  return [...new Set(words(text).filter((w) => EMOJI[w] || EMOJI[w.replace(/s$/, "")]))];
}

export class OfflineProvider implements AIProvider {
  readonly name = "offline";

  async chat(req: ChatRequest): Promise<ChatReply> {
    const { message, mode } = req;
    const lastTopic = [...req.history].reverse().map((t) => findTopic(t.content)).find(Boolean) ?? null;
    const topic = findTopic(message) ?? lastTopic;

    if (mode === "tutor") return this.tutor(req);

    if (mode === "appGuide") {
      const fact = topic ? this.bestFact(topic, message) : null;
      return {
        reply: fact ?? "I'm a practice guide, so I only know a little. Try asking about the things in this app!",
        topic: topic?.label ?? "",
        certainty: fact ? "sure" : "unsure",
        checkTip: "",
        followUp: "",
        suggestions: [],
      };
    }

    if (mode === "builder" || mode === "reviewer") {
      return {
        reply:
          "Your project is made of data the SparkForge engine reads: variables like score and lives, events like bumping into things, and conditions that decide when you win. Open the CODE tab to see each part — tap any section to learn what it does!",
        topic: "Building",
        certainty: "sure",
        checkTip: "",
        followUp: "Which part do you want to understand better?",
        suggestions: [],
      };
    }

    if (!topic) {
      const known = TOPICS.map((t) => `${t.emoji} ${t.label}`).join(", ");
      return {
        reply: `Great question! I'm running in offline practice mode right now, so I only know a few topics: ${known}. Ask me about one of those — or ask a grown-up to connect a real AI model to SparkForge.`,
        topic: "",
        certainty: "unsure",
        checkTip: "",
        followUp: "Which of those sounds most exciting?",
        suggestions: ["picture", "game"],
      };
    }

    const fact = this.bestFact(topic, message) ?? topic.facts[0].text;
    const young = req.ctx.age <= 7;
    const reply = young ? fact.split(/(?<=\.)\s/).slice(0, 2).join(" ") : fact;
    const suggestions: Suggestion[] = ["learn_more", "picture", "game", "quiz"];
    if (req.ctx.age >= 9) suggestions.push("app");
    return {
      reply: `${reply} ${topic.emoji}`,
      topic: topic.label,
      certainty: "sure",
      checkTip: req.ctx.age >= 9 ? "Want to double-check? Ask a grown-up to look it up with you on a science site like NASA or National Geographic Kids." : "",
      followUp: this.followUp(topic),
      suggestions,
    };
  }

  private bestFact(topic: Topic, message: string): string | null {
    const w = new Set(words(message));
    const text = message.toLowerCase();
    let best: { text: string; score: number } | null = null;
    for (const f of topic.facts) {
      const score = f.keys.reduce((s, k) => s + (k.includes(" ") ? (text.includes(k) ? 2 : 0) : w.has(k) ? 1 : 0), 0);
      if (score && (!best || score > best.score)) best = { text: f.text, score };
    }
    if (/more|else|another|tell me/i.test(message) && !best) {
      return topic.facts[Math.floor(Math.random() * topic.facts.length)].text;
    }
    return best?.text ?? null;
  }

  private followUp(topic: Topic): string {
    const q: Record<string, string> = {
      mars: "If you could drive a rover on Mars, where would you go first?",
      space: "Which planet would you visit, and what would you pack?",
      volcanoes: "What do you think it looks like inside a volcano?",
      animals: "Which animal would you like to be for a day?",
      ocean: "What do you think lives at the very bottom of the ocean?",
      dinosaurs: "If you found a dinosaur egg, what would you name the baby?",
      robots: "What job would you give your own robot?",
    };
    return q[topic.id] ?? "What do you want to find out next?";
  }

  private tutor(req: ChatRequest): ChatReply {
    const m = req.message;
    const math = m.match(/(-?\d+(?:\.\d+)?)\s*([+\-x×*/÷])\s*(-?\d+(?:\.\d+)?)/);
    const answersOk = req.ctx.homeworkMode === "answers" && !/don'?t (tell|give)/i.test(m);
    if (req.image) {
      return {
        reply: "I can't read photos in offline practice mode. Can you type the question from your worksheet? Then we'll work through it together.",
        topic: "Homework",
        certainty: "unsure",
        checkTip: "",
        followUp: "What does the first question say?",
        suggestions: [],
      };
    }
    if (math) {
      const [a, op, b] = [Number(math[1]), math[2], Number(math[3])];
      const result = op === "+" ? a + b : op === "-" ? a - b : /[x×*]/.test(op) ? a * b : b !== 0 ? a / b : NaN;
      const how: Record<string, string> = {
        "+": `Start at ${a} and count up ${b} more. Or split the numbers into tens and ones and add each part.`,
        "-": `Start at ${a} and count back ${b}. Or think: what number plus ${b} makes ${a}?`,
        x: `${a} × ${b} means ${b} groups of ${a}. You can add ${a} again and again, ${b} times.`,
        "/": `${a} ÷ ${b} asks: how many groups of ${b} fit into ${a}?`,
      };
      const key = /[x×*]/.test(op) ? "x" : /[/÷]/.test(op) ? "/" : op;
      return {
        reply: answersOk
          ? `${how[key]} So the answer is ${Number.isFinite(result) ? +result.toFixed(4) : "undefined (you can't divide by zero!)"}.`
          : `${how[key]} Try it and tell me what you get — I'll check it for you!`,
        topic: "Math",
        certainty: "sure",
        checkTip: answersOk ? "Check it the other way round: use the opposite operation." : "",
        followUp: answersOk ? "Want to try a similar one on your own?" : "What answer did you get?",
        suggestions: [],
      };
    }
    const guess = m.match(/^\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (guess) {
      const prev = [...req.history].reverse().find((t) => t.role === "user" && /[+\-x×*/÷]/.test(t.content));
      const pm = prev?.content.match(/(-?\d+(?:\.\d+)?)\s*([+\-x×*/÷])\s*(-?\d+(?:\.\d+)?)/);
      if (pm) {
        const [a, op, b] = [Number(pm[1]), pm[2], Number(pm[3])];
        const r = op === "+" ? a + b : op === "-" ? a - b : /[x×*]/.test(op) ? a * b : a / b;
        const ok = Math.abs(r - Number(guess[1])) < 1e-9;
        return {
          reply: ok ? "Yes! That's correct. 🎉 You worked it out yourself!" : "Not quite — good try! Look at your steps again. Where might it have gone off?",
          topic: "Math",
          certainty: "sure",
          checkTip: "",
          followUp: ok ? "Ready for the next question?" : "Want a hint?",
          suggestions: [],
        };
      }
    }
    const topic = findTopic(m);
    const fact = topic ? this.bestFact(topic, m) : null;
    return {
      reply: fact
        ? `Here's something that helps: ${fact} Now, how would you write the answer in your own words?`
        : "Let's break it down. What is the question asking you to find? Tell me the first step you'd try, and I'll help from there.",
      topic: topic?.label ?? "Homework",
      certainty: fact ? "sure" : "mostly",
      checkTip: "",
      followUp: "What do you think the first step is?",
      suggestions: [],
    };
  }

  async scene(ctx: ChildContext, prompt: string): Promise<SceneSpec> {
    const topic = findTopic(prompt) ?? GENERIC;
    const nouns = drawableNouns(prompt).filter((n) => !SELF_WORDS.has(n));
    const includeMe = /\b(me|i|myself)\b/i.test(prompt);
    const elements: SceneSpec["elements"] = [];
    const place = (emoji: string, label: string, x: number, y: number, size: number) => elements.push({ emoji, label, x, y, size });
    // Layered composition: sky objects, a landmark, the subjects, then foreground details.
    if (topic.style === "space" || topic.style === "night" || topic.id === "mars") place(topic.id === "mars" ? "🪐" : "🌙", "", 14, 16, 10);
    if (topic.id === "mars") {
      place("🌋", "Olympus Mons", 76, 48, 28);
      place("🚙", "Rover", 58, 76, 13);
    } else if (topic.id !== "generic") {
      place(topic.items[0]?.emoji ?? topic.emoji, topic.items[0]?.title ?? "", 76, 46, 24);
    }
    const spots = [[30, 62], [52, 56], [18, 74], [66, 68], [42, 80]];
    nouns.slice(0, 5).forEach((n, i) => place(emojiFor(n), capitalize(n), spots[i][0], spots[i][1], 15));
    if (includeMe) place(ctx.avatar, "Me!", 38, 66, 20);
    topic.decorations.forEach((d, i) => place(d, "", [8, 92, 22][i] ?? 50, [86, 84, 90][i] ?? 88, 8));
    if (elements.length < 6) topic.collectibles.slice(0, 2).forEach((c, i) => place(c.emoji, "", 24 + i * 50, 30 + i * 6, 8));
    const subject = nouns.length ? nouns.join(" and ") : topic.label.toLowerCase();
    return normalizeScene({
      title: capitalize(prompt.replace(/^(make|draw|create|show)\s+(me\s+)?(a\s+)?(picture|image|drawing)?\s*(of\s+)?/i, "").slice(0, 50)) || topic.label,
      caption: `${includeMe ? "You" : capitalize(subject)} in a ${topic.id === "generic" ? "colorful" : topic.label} scene.`,
      style: topic.style,
      sky: topic.sky,
      ground: topic.ground,
      elements,
    });
  }

  async story(ctx: ChildContext, prompt: string): Promise<StorySpec> {
    const topic = findTopic(prompt) ?? GENERIC;
    const heroWord = drawableNouns(prompt)[0];
    const hero = heroWord ? capitalize(heroWord) : topic.player.name;
    const heroEmoji = heroWord ? emojiFor(heroWord) : topic.player.emoji;
    const fact = topic.facts[0]?.text ?? "";
    const place = topic.label === "Adventure" ? "a faraway land" : topic.label === "Mars" ? "Mars" : `the world of ${topic.label.toLowerCase()}`;
    const pages = [
      { text: `Once upon a time, a curious ${hero.toLowerCase()} named Pip lived in ${place}. Pip loved asking “why?” about everything.`, emoji: heroEmoji },
      { text: `One morning, Pip discovered something amazing: ${fact || "the world is full of surprises."}`, emoji: topic.emoji },
      { text: `But then — uh oh! — a ${topic.hazards[0].name.toLowerCase()} blocked the way home. Pip felt worried, but took a deep breath.`, emoji: topic.hazards[0].emoji },
      { text: `Pip remembered what they had learned and made a plan, step by step. They tried once, it didn't work, so they changed the plan and tried again.`, emoji: "🧠" },
      { text: `It worked! Pip found the way home carrying a shiny ${topic.collectibles[0].name.toLowerCase()} to share with friends.`, emoji: topic.collectibles[0].emoji },
    ];
    if (ctx.age <= 7) pages.splice(3, 1);
    return normalizeStory({ title: `${hero} and the Big Discovery`, pages, moral: "When something doesn't work, change the plan and try again." });
  }

  async game(ctx: ChildContext, req: { idea: string; kind: GameKind; topicNotes: string }): Promise<{ spec: GameSpec; summary: string; aiHelped: string[] }> {
    const topic = findTopic(`${req.idea} ${req.topicNotes}`) ?? GENERIC;
    const extras = drawableNouns(req.idea).filter((n) => !topic.keywords.includes(n) && !SELF_WORDS.has(n));
    const hazards = [...topic.hazards];
    const collectibles = topic.collectibles.map((c, i) => ({ ...c, points: i === 0 ? 1 : i + 1 }));
    for (const n of extras.slice(0, 2)) {
      if (DANGER_WORDS.has(n)) hazards.unshift({ emoji: emojiFor(n), name: capitalize(n), moves: true });
      else collectibles.unshift({ emoji: emojiFor(n), name: capitalize(n), fact: "", points: 2 });
    }
    const easy = ctx.age <= 7;
    const spec = normalizeGame({
      title: `${topic.label === "Adventure" ? capitalize(extras[0] ?? "Star") : topic.label} ${
        req.kind === "quiz" ? "Quiz" : req.kind === "explorer" ? "Explorer" : "Catcher"
      }`,
      kind: req.kind,
      goal:
        req.kind === "quiz"
          ? `Answer questions about ${topic.label.toLowerCase()} to score points!`
          : req.kind === "explorer"
            ? `Move the ${topic.player.name.toLowerCase()} to collect every treasure and avoid the ${hazards[0].name.toLowerCase()}!`
            : `Catch ${collectibles[0].emoji} ${collectibles[0].name.toLowerCase()} and dodge ${hazards[0].emoji} ${hazards[0].name.toLowerCase()}!`,
      theme: { sky: topic.sky, ground: topic.ground, decorations: topic.decorations },
      player: { ...topic.player, speed: 5 },
      collectibles: collectibles.slice(0, 4),
      hazards: hazards.slice(0, 3),
      rules: { lives: easy ? 5 : 3, timeLimit: 0 },
      levels:
        req.kind === "quiz"
          ? [
              { name: "Warm-up", targetScore: 10, spawnRate: 1, hazardSpeed: 1 },
              { name: "Brainy", targetScore: 20, spawnRate: 1, hazardSpeed: 1 },
              { name: "Genius", targetScore: 30, spawnRate: 1, hazardSpeed: 1 },
            ]
          : req.kind === "explorer"
            ? [
                { name: "Level 1", targetScore: 8, spawnRate: 2, hazardSpeed: 2 },
                { name: "Level 2", targetScore: 18, spawnRate: 3, hazardSpeed: 3 },
                { name: "Level 3", targetScore: 30, spawnRate: 4, hazardSpeed: 4 },
              ]
            : [
                { name: "Level 1", targetScore: easy ? 8 : 10, spawnRate: 3, hazardSpeed: 2 },
                { name: "Level 2", targetScore: easy ? 18 : 25, spawnRate: 4, hazardSpeed: 4 },
                { name: "Level 3", targetScore: easy ? 30 : 45, spawnRate: 5, hazardSpeed: 5 },
              ],
      quiz: req.kind === "quiz" ? topic.quiz.length ? topic.quiz : TOPICS[1].quiz : [],
    });
    return {
      spec,
      summary: `A ${GAME_KIND_INFO[req.kind].label.toLowerCase()} game about ${topic.label.toLowerCase()} with ${spec.levels.length} levels.`,
      aiHelped: ["picked the characters and emojis", "set up 3 levels", topic.id === "generic" ? "chose the colors" : `added real ${topic.label} facts`],
    };
  }

  async modifyGame(_ctx: ChildContext, spec: GameSpec, request: string): Promise<Modification<GameSpec>> {
    const s: GameSpec = structuredClone(spec);
    const changes: string[] = [];
    const explain: string[] = [];
    let concept = "Variables";
    // Handle each clause separately: "make it faster and add rocks" = two requests.
    for (const r of request.toLowerCase().split(/\s*(?:,|;|\band\b|\bthen\b|\balso\b)\s*/).filter(Boolean)) {
    const num = Number(r.match(/\b(\d{1,2})\b/)?.[1] ?? NaN);
    const wordNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    const count = Number.isFinite(num) ? num : (wordNum[r.match(/\b(one|two|three|four|five|six)\b/)?.[1] ?? ""] ?? 1);

    const aboutDangers = /(rock|meteor|hazard|danger|enem|alien|fall|storm|obstacle)/.test(r);
    if (/\b(faster|speed up|quicker)\b/.test(r) && aboutDangers) {
      s.levels = s.levels.map((l) => ({ ...l, hazardSpeed: Math.min(10, l.hazardSpeed + 2) }));
      changes.push("Made the dangers faster");
      explain.push("Each level stores how fast dangers move. I raised that number, so they cover more distance every frame.");
      concept = "Movement";
    } else if (/\b(faster|speed up|quicker|zoom)\b/.test(r)) {
      const old = s.player.speed;
      s.player.speed = Math.min(10, old + 2);
      changes.push(`Made the ${s.player.name.toLowerCase()} faster`);
      explain.push(`Speed is a variable. I changed it from ${old} to ${s.player.speed}, so the ${s.player.name.toLowerCase()} moves further each frame.`);
      concept = "Movement";
    }
    if (/\b(slower|slow down)\b/.test(r)) {
      const old = s.player.speed;
      s.player.speed = Math.max(1, old - 2);
      changes.push(`Made the ${s.player.name.toLowerCase()} slower`);
      explain.push(`I lowered the speed variable from ${old} to ${s.player.speed}.`);
      concept = "Movement";
    }
    if (/\b(harder|too easy|more difficult|challenge)\b/.test(r)) {
      s.levels = s.levels.map((l) => ({ ...l, hazardSpeed: Math.min(10, l.hazardSpeed + 2), spawnRate: Math.min(10, l.spawnRate + 1) }));
      changes.push("Made every level harder");
      explain.push("Each level has numbers for how often things appear and how fast dangers move. I turned them up.");
      concept = "Game Design";
    }
    if (/\b(easier|too hard|less difficult)\b/.test(r)) {
      s.levels = s.levels.map((l) => ({ ...l, hazardSpeed: Math.max(1, l.hazardSpeed - 2) }));
      s.rules.lives = Math.min(10, s.rules.lives + 2);
      changes.push("Made it easier");
      explain.push("I slowed the dangers down and gave you 2 extra lives.");
      concept = "Game Design";
    }
    const levelMatch = /\blevels?\b/.test(r) && /\b(add|more|another|new|one|two|three|four|five|six|\d+)\b/.test(r) && !/harder|easier|faster|slower/.test(r);
    if (levelMatch) {
      const n = Math.max(1, Math.min(5, count));
      for (let i = 0; i < n && s.levels.length < 10; i++) {
        const last = s.levels[s.levels.length - 1] ?? { targetScore: 0, spawnRate: 2, hazardSpeed: 2 };
        s.levels.push({
          name: `Level ${s.levels.length + 1}`,
          targetScore: last.targetScore + (s.kind === "quiz" ? 10 : 15),
          spawnRate: Math.min(10, last.spawnRate + 1),
          hazardSpeed: Math.min(10, last.hazardSpeed + 1),
        });
      }
      if (s.kind === "quiz") {
        const topic = findTopic(`${s.title} ${s.goal}`) ?? TOPICS[1];
        while (s.quiz.length * 10 < s.levels[s.levels.length - 1].targetScore) {
          const q = topic.quiz[s.quiz.length % topic.quiz.length];
          s.quiz.push({ ...q });
        }
      }
      changes.push(`Added ${n} level${n > 1 ? "s" : ""}`);
      explain.push("Levels are a list. The game loops through it: when your score reaches a level's target, it moves to the next one — which needs more points and is a bit faster.");
      concept = "Loops";
    }
    if (/\b(more lives|extra li(fe|ves))\b/.test(r)) {
      s.rules.lives = Math.min(10, s.rules.lives + Math.max(1, Math.min(5, count)));
      changes.push(`Lives set to ${s.rules.lives}`);
      explain.push(`Lives is a variable that starts at ${s.rules.lives}. Each time you bump into danger, the game subtracts 1. IF it reaches 0, THEN game over.`);
      concept = "Conditions";
    }
    if (/\b(fewer lives|less lives|one life)\b/.test(r)) {
      s.rules.lives = /one life/.test(r) ? 1 : Math.max(1, s.rules.lives - 1);
      changes.push(`Lives set to ${s.rules.lives}`);
      explain.push("Fewer lives means the IF lives = 0 condition happens sooner.");
      concept = "Conditions";
    }
    const timer = r.match(/(timer|time limit|seconds?)/);
    if (timer && !/no timer|remove (the )?timer/.test(r)) {
      const secs = Number.isFinite(num) && num >= 10 ? num : 60;
      s.rules.timeLimit = secs;
      changes.push(`Added a ${secs}-second timer`);
      explain.push("A timer counts down every second. When it hits 0, the game checks: did you reach the target score?");
      concept = "Timers";
    }
    if (/no timer|remove (the )?timer/.test(r)) {
      s.rules.timeLimit = 0;
      changes.push("Removed the timer");
      explain.push("I set the time limit to 0, which the game treats as “no timer”.");
      concept = "Timers";
    }
    const becomes = r.match(/(?:player|me|character|hero)\s+(?:is|be|into|to)\s+(?:a|an)?\s*([a-z]+)/) ?? r.match(/(?:play as|change (?:the )?player to)\s+(?:a|an)?\s*([a-z]+)/);
    if (becomes && EMOJI[becomes[1]] ) {
      s.player.emoji = emojiFor(becomes[1]);
      s.player.name = capitalize(becomes[1]);
      changes.push(`The player is now ${s.player.emoji} ${s.player.name}`);
      explain.push("The player's look is stored as data, so changing it doesn't change how the game works.");
      concept = "Data";
    }
    if (/\b(night|dark)\b/.test(r)) {
      s.theme.sky = "#0b1033";
      changes.push("Made it night time");
      explain.push("The sky color is a variable holding a color code.");
      concept = "Variables";
    }
    const addMatch = r.match(/\badd(?:ing)?\s+(?:some\s+|more\s+|a\s+|an\s+|the\s+|\d+\s+)?([a-z]+)/g);
    for (const phrase of addMatch ?? []) {
      const noun = phrase.split(/\s+/).pop()!;
      if (/^(level|levels|timer|lives|life|more|speed)$/.test(noun)) continue;
      const known = EMOJI[noun] || EMOJI[noun.replace(/s$/, "")];
      if (!known && !DANGER_WORDS.has(noun)) continue;
      const name = capitalize(noun.replace(/s$/, ""));
      if (DANGER_WORDS.has(noun) || DANGER_WORDS.has(noun.replace(/s$/, ""))) {
        if (!s.hazards.some((h) => h.name.toLowerCase() === name.toLowerCase()) && s.hazards.length < 6) {
          s.hazards.push({ emoji: emojiFor(noun, "🪨"), name, moves: /alien|ufo|ghost|bat|monster|zombie|shark|snake|storm/.test(noun) });
          changes.push(`Added ${emojiFor(noun, "🪨")} ${name}${noun.endsWith("s") ? "s" : ""} as a danger`);
          explain.push(`${name}s are a new kind of hazard. When the player touches one, a collision event fires and you lose a life.`);
          concept = "Collisions";
        }
      } else if (!s.collectibles.some((c) => c.name.toLowerCase() === name.toLowerCase()) && s.collectibles.length < 8) {
        s.collectibles.push({ emoji: emojiFor(noun), name, points: 2, fact: "" });
        changes.push(`Added ${emojiFor(noun)} ${name} to collect`);
        explain.push(`${name}s are worth 2 points. When you touch one, the score variable goes up.`);
        concept = "Variables";
      }
    }
    if (/\b(more points|double points|bigger score)\b/.test(r)) {
      s.collectibles = s.collectibles.map((c) => ({ ...c, points: Math.min(100, c.points * 2) }));
      changes.push("Doubled the points");
      explain.push("Each collectible has a points number. I multiplied them by 2.");
      concept = "Variables";
    }
    }
    const renamed = request.match(/(?:call it|rename (?:it )?(?:to)?|title (?:it|to))\s+["“]?([^"”]{2,40})["”]?/i);
    if (renamed) {
      s.title = renamed[1].trim();
      changes.push(`Renamed to “${s.title}”`);
      explain.push("The title is just a piece of text data.");
    }

    if (!changes.length) {
      return {
        spec,
        understood: false,
        summary: "",
        explanation:
          "I'm in offline practice mode, so I only understand simple changes. Try: “make it faster”, “add rocks”, “add 2 levels”, “add a timer”, “more lives”, “make it harder”, “make the player a cat”, or “make it night”. You can also change anything yourself in BUILD mode!",
        concept: "",
      };
    }
    return { spec: normalizeGame(s), understood: true, summary: changes.join(", "), explanation: explain.join(" "), concept };
  }

  async appPlan(_ctx: ChildContext, idea: string): Promise<AppPlan> {
    const topic = findTopic(idea);
    const thing = topic?.id === "animals" ? "Animal" : topic?.id === "space" ? "Planet" : topic?.id === "dinosaurs" ? "Dinosaur" : topic?.id === "ocean" ? "Sea creature" : topic?.id === "mars" ? "Mars place" : "Item";
    const pieces = [
      { name: "Home screen", why: "The first thing people see — the title and big buttons.", emoji: "🏠" },
      { name: `${thing} list`, why: `A collection of ${thing.toLowerCase()}s is the data your app shows.`, emoji: "📋" },
      { name: "Pictures", why: "Each item gets an emoji picture so it's fun to look at.", emoji: "🖼️" },
      { name: "Search", why: `Helps people find a ${thing.toLowerCase()} fast.`, emoji: "🔍" },
      { name: "Detail page", why: "Tap an item to see its facts.", emoji: "📄" },
    ];
    if (/\b(ai|guide|ask|chat|helper)\b/i.test(idea)) pieces.push({ name: "AI Guide", why: "A friendly AI you can ask questions.", emoji: "🤖" });
    if (/\bquiz\b/i.test(idea)) pieces.push({ name: "Quiz screen", why: "Test what you learned.", emoji: "❓" });
    return {
      title: topic ? `${topic.label} Explorer` : capitalize(idea.replace(/^(i want )?(an? )?(app|application)\s*(about|for)?\s*/i, "").slice(0, 40)) || "My App",
      emoji: topic?.emoji ?? "📱",
      pieces,
      question: "Does this plan look right? You can remove pieces or add your own ideas.",
    };
  }

  async app(_ctx: ChildContext, req: { idea: string; plan: AppPlan; allowAiGuide: boolean }): Promise<{ spec: AppSpec; summary: string; aiHelped: string[] }> {
    const topic = findTopic(`${req.idea} ${req.plan.title}`);
    const has = (name: string) => req.plan.pieces.some((p) => p.name.toLowerCase().includes(name));
    const items = topic?.items ?? [
      { title: "My first idea", emoji: "💡", subtitle: "Tap to edit in BUILD mode", description: "Add your own items to fill your app.", facts: ["You can add facts too!"] },
      { title: "Another idea", emoji: "⭐", subtitle: "Make it yours", description: "", facts: [] },
    ];
    const col = topic ? topic.label.toLowerCase().replace(/[^a-z]+/g, "-") : "items";
    const screens: AppSpec["screens"] = [
      {
        id: "home",
        title: "Home",
        emoji: "🏠",
        inNav: true,
        blocks: [
          blankBlock("image", { emoji: req.plan.emoji || topic?.emoji || "📱" }),
          blankBlock("heading", { text: req.plan.title }),
          blankBlock("text", { text: topic ? `Discover amazing facts about ${topic.label.toLowerCase()}!` : req.idea }),
          blankBlock("button", { text: "Start exploring", goTo: "list" }),
        ],
      },
      {
        id: "list",
        title: topic ? topic.label : "Items",
        emoji: "📋",
        inNav: true,
        blocks: [...(has("search") ? [blankBlock("search", { collection: col })] : []), blankBlock("list", { collection: col, goTo: "detail" })],
      },
      {
        id: "detail",
        title: "Details",
        emoji: "📄",
        inNav: false,
        blocks: [
          blankBlock("image", { emoji: "{{emoji}}" }),
          blankBlock("heading", { text: "{{title}}" }),
          blankBlock("text", { text: "{{subtitle}}" }),
          blankBlock("text", { text: "{{description}}" }),
          blankBlock("facts"),
          blankBlock("button", { text: "Back to list", goTo: "list" }),
        ],
      },
    ];
    if (has("ai guide") && req.allowAiGuide) {
      screens.push({
        id: "guide",
        title: "Ask",
        emoji: "🤖",
        inNav: true,
        blocks: [
          blankBlock("heading", { text: "Ask the guide" }),
          blankBlock("aiGuide", { text: `a friendly ${topic?.label ?? "topic"} expert`, emoji: "🤖" }),
        ],
      });
    }
    const spec = normalizeApp({
      title: req.plan.title,
      description: req.idea,
      theme: { color: (topic && APP_COLORS[topic.id]) || "#6c4cf5", emoji: req.plan.emoji || "📱" },
      collections: [{ name: col, items }],
      screens,
      startScreen: "home",
    });
    return {
      spec,
      summary: `An app with ${spec.screens.length} screens and ${items.length} ${topic ? topic.label.toLowerCase() : "items"}.`,
      aiHelped: ["designed the screens", topic ? `wrote the ${topic.label.toLowerCase()} facts` : "made starter items", "connected the navigation"],
    };
  }

  async modifyApp(_ctx: ChildContext, spec: AppSpec, request: string, allowAiGuide: boolean): Promise<Modification<AppSpec>> {
    const a: AppSpec = structuredClone(spec);
    const r = request.toLowerCase();
    const changes: string[] = [];
    const explain: string[] = [];
    let concept = "Components";
    const listScreen = a.screens.find((s) => s.blocks.some((b) => b.type === "list"));
    const colName = listScreen?.blocks.find((b) => b.type === "list")?.collection ?? a.collections[0]?.name ?? "items";

    if (/\bsearch\b/.test(r) && listScreen && !listScreen.blocks.some((b) => b.type === "search")) {
      listScreen.blocks.unshift(blankBlock("search", { collection: colName }));
      changes.push("Added a search box");
      explain.push("Search is a component that filters the list: it keeps only the items whose title contains what you typed.");
      concept = "Search";
    }
    const addItem = request.match(/add\s+(?:an?\s+)?(?:item|animal|planet|dinosaur|creature|thing)?\s*(?:called|named)?\s*["“]?([A-Za-z][A-Za-z ]{1,30})["”]?\s*(?:to the list)?$/i);
    if (addItem && !/search|screen|guide|button|color|colour|quiz|name input/i.test(request)) {
      const title = capitalize(addItem[1].trim().replace(/^(a|an|the)\s+/i, ""));
      const col = a.collections.find((c) => c.name === colName) ?? a.collections[0];
      if (col) {
        col.items.push({ title, emoji: emojiFor(title.split(" ").pop() ?? "", "⭐"), subtitle: "Added by me!", description: "", facts: [] });
        changes.push(`Added ${title} to the list`);
        explain.push("The list shows data from a collection. Adding an item to the collection makes it appear everywhere the list is used.");
        concept = "Data";
      }
    }
    if (/\b(ai|guide|chat|ask)\b/.test(r) && !a.screens.some((s) => s.blocks.some((b) => b.type === "aiGuide"))) {
      if (!allowAiGuide) {
        return { spec, understood: false, summary: "", explanation: "AI guides inside apps are turned off in your family settings. Ask a parent if you'd like to try them!", concept: "" };
      }
      a.screens.push({ id: "guide", title: "Ask", emoji: "🤖", inNav: true, blocks: [blankBlock("heading", { text: "Ask the guide" }), blankBlock("aiGuide", { text: `a friendly ${a.title} guide`, emoji: "🤖" })] });
      changes.push("Added an AI Guide screen");
      explain.push("The AI Guide block sends questions to an AI model with instructions (a prompt) to stay on your app's topic.");
      concept = "AI Models";
    }
    if (/\b(about|info) (screen|page)\b/.test(r)) {
      a.screens.push({ id: "about", title: "About", emoji: "ℹ️", inNav: true, blocks: [blankBlock("heading", { text: "About this app" }), blankBlock("text", { text: `I made ${a.title} with SparkForge!` })] });
      changes.push("Added an About screen");
      explain.push("A new screen is a new place in the app. Showing it in the bottom bar is navigation.");
      concept = "Navigation";
    }
    if (/\b(name|type|input)\b/.test(r) && /\b(ask|input|type)\b/.test(r)) {
      const home = a.screens.find((s) => s.id === a.startScreen) ?? a.screens[0];
      home?.blocks.push(blankBlock("input", { text: "What's your name?", variable: "name" }), blankBlock("text", { text: "Hi {{name}}! 👋" }));
      changes.push("Added a name input");
      explain.push("The input stores what you type in a variable called name. The text block shows it with {{name}}.");
      concept = "User Input";
    }
    const colors: Record<string, string> = { red: "#e5484d", blue: "#3d63dd", green: "#30a46c", purple: "#6c4cf5", pink: "#d6409f", orange: "#f76b15", yellow: "#e5a50a", black: "#1c2024", teal: "#12a594" };
    const color = Object.keys(colors).find((c) => new RegExp(`\\b${c}\\b`).test(r));
    if (color && /(color|colour|theme|make it)/.test(r)) {
      a.theme.color = colors[color];
      changes.push(`Changed the color to ${color}`);
      explain.push("The theme color is one variable that every screen reads — change it once, it changes everywhere.");
      concept = "User Interfaces";
    }
    if (!changes.length) {
      return {
        spec,
        understood: false,
        summary: "",
        explanation:
          "I'm in offline practice mode, so I understand simple changes like: “add search”, “add an AI guide”, “add an about screen”, “ask for my name”, “make it blue”, or “add Penguin”. You can also change anything yourself in BUILD mode!",
        concept: "",
      };
    }
    return { spec: normalizeApp(a), understood: true, summary: changes.join(", "), explanation: explain.join(" "), concept };
  }

  async detective(_ctx: ChildContext, topicHint: string): Promise<DetectiveCase> {
    const topic = findTopic(topicHint) ?? TOPICS[Math.floor(Math.random() * TOPICS.length)];
    return { topic: topic.label, ...topic.detective };
  }

  async checkUnderstanding(_ctx: ChildContext, _project: string, explanation: string) {
    const n = words(explanation).length;
    const conceptWords = /(variable|score|speed|level|loop|if|then|event|condition|list|data|screen|button|collect|lives|timer|search|navigation)/i.test(explanation);
    const understood = n >= 12 && conceptWords;
    return {
      understood,
      feedback: understood
        ? "Great explanation! You described how the parts work together — that's real engineering thinking. 🧠"
        : n < 12
          ? "Good start! Can you add a bit more? Try explaining what happens when the player touches something, or how the score changes."
          : "Nice! Try to mention one of the parts, like the score variable, the levels or a button, and what it does.",
    };
  }

  async moderate(_text: string) {
    return { safe: true, reason: "" };
  }
}
