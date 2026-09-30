// The constrained application model: screens composed from safe building blocks.
import { z } from "zod";

export const BLOCK_TYPES = [
  "heading",
  "text",
  "image",
  "card",
  "button",
  "list",
  "search",
  "input",
  "facts",
  "aiGuide",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_INFO: Record<BlockType, { label: string; emoji: string; concept: string; about: string }> = {
  heading: { label: "Heading", emoji: "🔠", concept: "User Interfaces", about: "Big title text" },
  text: { label: "Text", emoji: "📝", concept: "User Interfaces", about: "A paragraph. Use {{title}} to show the chosen item, or {{name}} for something the user typed." },
  image: { label: "Picture", emoji: "🖼️", concept: "User Interfaces", about: "A big emoji picture" },
  card: { label: "Card", emoji: "🃏", concept: "Components", about: "A box with an emoji, title and text" },
  button: { label: "Button", emoji: "🔘", concept: "Events", about: "Goes to another screen when tapped" },
  list: { label: "List", emoji: "📋", concept: "Data", about: "Shows every item in a collection" },
  search: { label: "Search", emoji: "🔍", concept: "Search", about: "Filters the list on the same screen" },
  input: { label: "Input", emoji: "⌨️", concept: "User Input", about: "Lets the user type something and remembers it in a variable" },
  facts: { label: "Facts", emoji: "💡", concept: "Data", about: "Shows the facts of the chosen item" },
  aiGuide: { label: "AI Guide", emoji: "🤖", concept: "AI Models", about: "A friendly AI helper that answers questions about the topic" },
};

export const AppBlock = z.object({
  type: z.enum(BLOCK_TYPES),
  text: z.string(),
  emoji: z.string(),
  goTo: z.string(), // screen id for buttons and list items
  collection: z.string(), // collection name for list / search
  variable: z.string(), // variable name for input blocks
});
export type AppBlock = z.infer<typeof AppBlock>;

export const AppItem = z.object({
  title: z.string(),
  emoji: z.string(),
  subtitle: z.string(),
  description: z.string(),
  facts: z.array(z.string()),
});
export type AppItem = z.infer<typeof AppItem>;

export const AppSpecInput = z.object({
  title: z.string(),
  description: z.string(),
  theme: z.object({ color: z.string(), emoji: z.string() }),
  collections: z.array(z.object({ name: z.string(), items: z.array(AppItem) })),
  screens: z.array(
    z.object({ id: z.string(), title: z.string(), emoji: z.string(), inNav: z.boolean(), blocks: z.array(AppBlock) }),
  ),
  startScreen: z.string(),
});
export type AppSpec = z.infer<typeof AppSpecInput>;

export const blankBlock = (type: BlockType, patch: Partial<AppBlock> = {}): AppBlock => ({
  type,
  text: "",
  emoji: "",
  goTo: "",
  collection: "",
  variable: "",
  ...patch,
});

const s = (v: unknown, max: number, fb = "") => (typeof v === "string" ? v : fb).slice(0, max);
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "screen";

export function normalizeApp(input: AppSpec): AppSpec {
  const screens = (input.screens ?? []).slice(0, 12).map((sc, i) => ({
    id: slug(s(sc.id, 40) || s(sc.title, 40) || `screen-${i + 1}`),
    title: s(sc.title, 40, "Screen") || "Screen",
    emoji: s(sc.emoji, 8, "📱"),
    inNav: !!sc.inNav,
    blocks: (sc.blocks ?? []).slice(0, 20).map((b) => ({
      type: BLOCK_TYPES.includes(b.type) ? b.type : "text",
      text: s(b.text, 400),
      emoji: s(b.emoji, 16), // room for "{{emoji}}" templates
      goTo: b.goTo ? slug(s(b.goTo, 40)) : "",
      collection: s(b.collection, 40),
      variable: s(b.variable, 30).replace(/[^a-zA-Z0-9_]/g, ""),
    })),
  }));
  // Deduplicate ids so navigation stays unambiguous.
  const seen = new Set<string>();
  for (const sc of screens) {
    let id = sc.id;
    for (let n = 2; seen.has(id); n++) id = `${sc.id}-${n}`;
    sc.id = id;
    seen.add(id);
  }
  return {
    title: s(input.title, 60, "My App") || "My App",
    description: s(input.description, 240),
    theme: {
      color: /^#[0-9a-fA-F]{6}$/.test(input.theme?.color ?? "") ? input.theme.color : "#6c4cf5",
      emoji: s(input.theme?.emoji, 8, "📱") || "📱",
    },
    collections: (input.collections ?? []).slice(0, 4).map((c) => ({
      name: s(c.name, 40, "items") || "items",
      items: (c.items ?? []).slice(0, 40).map((it) => ({
        title: s(it.title, 60),
        emoji: s(it.emoji, 8, "•"),
        subtitle: s(it.subtitle, 100),
        description: s(it.description, 600),
        facts: (it.facts ?? []).slice(0, 8).map((f) => s(f, 200)),
      })),
    })),
    screens,
    startScreen: slug(s(input.startScreen, 40)) || screens[0]?.id || "home",
  };
}

export interface AppCheck {
  id: string;
  question: string;
  passed: boolean;
  bug?: { id: string; title: string; explanation: string; hint: string; where: string; concept: string };
}

export function testApp(spec: AppSpec): AppCheck[] {
  const ids = new Set(spec.screens.map((x) => x.id));
  const cols = new Map(spec.collections.map((c) => [c.name, c]));
  const checks: AppCheck[] = [];
  const add = (id: string, question: string, bug: AppCheck["bug"] | null) =>
    checks.push({ id, question, passed: !bug, ...(bug ? { bug } : {}) });

  add(
    "start-loads",
    "Does the first screen load?",
    !ids.has(spec.startScreen)
      ? {
          id: "missing-start",
          title: "🐛 The app opens to nothing",
          explanation: `The app starts on a screen called “${spec.startScreen}”, but no screen has that name.`,
          hint: "Which screen should the app open on?",
          where: "startScreen",
          concept: "Navigation",
        }
      : null,
  );
  const dead = spec.screens.flatMap((sc) =>
    sc.blocks.filter((b) => (b.type === "button" || b.type === "list") && b.goTo && !ids.has(b.goTo)).map((b) => ({ sc, b })),
  );
  add(
    "buttons-work",
    "Does every button go somewhere?",
    dead.length
      ? {
          id: "dead-button",
          title: `🐛 “${dead[0].b.text || dead[0].b.type}” on ${dead[0].sc.title} goes nowhere`,
          explanation: `It tries to open the screen “${dead[0].b.goTo}”, which doesn't exist.`,
          hint: "Check where the button is supposed to go.",
          where: `screens.${dead[0].sc.id}`,
          concept: "Events",
        }
      : null,
  );
  const emptyList = spec.screens.flatMap((sc) =>
    sc.blocks.filter((b) => b.type === "list" && !(cols.get(b.collection)?.items.length)).map((b) => ({ sc, b })),
  );
  add(
    "lists-have-data",
    "Do the lists show something?",
    emptyList.length
      ? {
          id: "empty-list",
          title: `🐛 The list on ${emptyList[0].sc.title} is empty`,
          explanation: `It shows the collection “${emptyList[0].b.collection}”, but that collection has no items (or doesn't exist).`,
          hint: "A list needs data. Which collection should it use?",
          where: `screens.${emptyList[0].sc.id}`,
          concept: "Data",
        }
      : null,
  );
  const lonelySearch = spec.screens.find(
    (sc) => sc.blocks.some((b) => b.type === "search") && !sc.blocks.some((b) => b.type === "list"),
  );
  add(
    "search-works",
    "Does search filter something?",
    lonelySearch
      ? {
          id: "lonely-search",
          title: `🐛 Search on ${lonelySearch.title} has nothing to search`,
          explanation: "A search box filters the list on the same screen — but this screen has no list.",
          hint: "What should the search box be searching through?",
          where: `screens.${lonelySearch.id}`,
          concept: "Search",
        }
      : null,
  );
  const emptyInput = spec.screens.find((sc) => sc.blocks.some((b) => b.type === "input" && !b.variable));
  add(
    "input-remembered",
    "Is typed input remembered?",
    emptyInput
      ? {
          id: "input-no-variable",
          title: `🐛 Typing on ${emptyInput.title} is forgotten`,
          explanation: "The input box has no variable name, so what the user types isn't stored anywhere.",
          hint: "Give the input a name so the app can remember it.",
          where: `screens.${emptyInput.id}`,
          concept: "Variables",
        }
      : null,
  );
  return checks;
}

export function autoFixApp(spec: AppSpec, bugId: string): AppSpec {
  const a: AppSpec = structuredClone(spec);
  const first = a.screens[0]?.id;
  switch (bugId) {
    case "missing-start":
      if (first) a.startScreen = first;
      break;
    case "dead-button": {
      const ids = new Set(a.screens.map((x) => x.id));
      for (const sc of a.screens)
        for (const b of sc.blocks) if ((b.type === "button" || b.type === "list") && b.goTo && !ids.has(b.goTo)) b.goTo = first ?? "";
      break;
    }
    case "empty-list": {
      const withItems = a.collections.find((c) => c.items.length);
      for (const sc of a.screens)
        for (const b of sc.blocks)
          if (b.type === "list" && !a.collections.find((c) => c.name === b.collection)?.items.length) {
            if (withItems) b.collection = withItems.name;
            else {
              a.collections.push({
                name: "items",
                items: [{ title: "My first item", emoji: "⭐", subtitle: "Edit me!", description: "", facts: [] }],
              });
              b.collection = "items";
            }
          }
      break;
    }
    case "lonely-search":
      for (const sc of a.screens)
        if (sc.blocks.some((b) => b.type === "search") && !sc.blocks.some((b) => b.type === "list")) {
          const col = sc.blocks.find((b) => b.type === "search")?.collection || a.collections[0]?.name || "";
          sc.blocks.push(blankBlock("list", { collection: col }));
        }
      break;
    case "input-no-variable":
      for (const sc of a.screens) for (const b of sc.blocks) if (b.type === "input" && !b.variable) b.variable = "name";
      break;
  }
  return normalizeApp(a);
}

export function appConcepts(spec: AppSpec): string[] {
  const c = new Set<string>(["User Interfaces", "Components"]);
  if (spec.screens.length > 1) c.add("Navigation");
  for (const sc of spec.screens) for (const b of sc.blocks) c.add(BLOCK_INFO[b.type].concept);
  if (spec.collections.length) c.add("Data");
  return [...c];
}

export function diffApps(a: AppSpec, b: AppSpec): string[] {
  const out: string[] = [];
  if (a.title !== b.title) out.push(`Renamed to “${b.title}”`);
  const aIds = new Set(a.screens.map((x) => x.id));
  const bIds = new Set(b.screens.map((x) => x.id));
  for (const sc of b.screens) if (!aIds.has(sc.id)) out.push(`Added screen ${sc.emoji} ${sc.title}`);
  for (const sc of a.screens) if (!bIds.has(sc.id)) out.push(`Removed screen ${sc.title}`);
  for (const sc of b.screens) {
    const old = a.screens.find((x) => x.id === sc.id);
    if (old && JSON.stringify(old.blocks) !== JSON.stringify(sc.blocks)) out.push(`Changed the ${sc.title} screen`);
  }
  const count = (x: AppSpec) => x.collections.reduce((n, c) => n + c.items.length, 0);
  if (count(a) !== count(b)) out.push(`Items ${count(a)} → ${count(b)}`);
  if (a.theme.color !== b.theme.color || a.theme.emoji !== b.theme.emoji) out.push("Changed the look");
  return out;
}
