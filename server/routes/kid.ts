import { Router, type Request } from "express";
import { z } from "zod";
import { all, newId, now, one, run } from "../db";
import { requireChild } from "../auth";
import { body, forbid, h, HttpError, notFound } from "../http";
import { checkText, recordSafetyEvent } from "../safety";
import { callAI } from "../ai/gateway";
import { findTopic } from "../ai/knowledge";
import type { AppPlan, ChatReply, ChatTurn } from "../ai/types";
import { AppPlanSchema } from "../ai/types";
import { childContext, creatorLevel, getChild } from "../engines/children";
import { evaluate, notify, passport, recordEvent, type Rewards } from "../engines/progress";
import {
  addJournal,
  createProject,
  deleteProject,
  getJournal,
  getProject,
  getVersionSpec,
  listProjects,
  listVersions,
  saveVersion,
} from "../engines/projects";
import { missionProgress, settleMissions } from "../engines/missions";
import { collaboratorsOf, isCollaborator, reactionsOf, tasksOf } from "../engines/social";
import { activateShare, activeShare, createShare, sharesFor, type Audience } from "./shares";
import { GAME_KINDS, GameSpecInput, autoFixGame, diffGames, gameConcepts, normalizeGame, testGame, type GameSpec } from "../../shared/game";
import { AppSpecInput, appConcepts, autoFixApp, diffApps, normalizeApp, testApp, type AppSpec } from "../../shared/app";
import { CodeSpec, SceneSpec, StorySpec, normalizeCode, normalizeScene, normalizeStory } from "../../shared/creations";
import type { ChildProfile, Permissions, ProjectType } from "../../shared/types";
import { ejectGame } from "../../shared/export";
import { projectHtml, STARTER_CODE } from "../engines/exporter";

export const kidRouter = Router();
kidRouter.use(requireChild);

const me = (req: Request) => {
  const c = getChild(req.session!.childId!);
  if (!c) throw new HttpError(401, "Profile not found");
  return c;
};

function need(child: ChildProfile, key: keyof Permissions, what: string) {
  if (!child.permissions[key]) throw forbid(`${what} is turned off in your family settings. Ask a parent if you'd like to try it!`);
}

/** Safety gate for free text the child types. Throws a kind 422 for blocked content. */
function guard(child: ChildProfile, text: string, source: string): { text: string; tip: string | null } {
  const r = checkText(text, child.age, "input");
  if (r.verdict === "allow") return { text, tip: null };
  recordSafetyEvent(child.id, r, source, text);
  if (r.verdict === "redact") return { text: r.cleanText, tip: r.childMessage };
  throw Object.assign(new HttpError(422, r.childMessage!), { safety: true });
}

function after(childId: string, projectId: string | null, concepts: string[] = []): Rewards {
  settleMissions(childId);
  return evaluate(childId, projectId, concepts);
}

/** Owner-only actions: delete, share, send. */
function ownProject(req: Request) {
  const p = getProject(String(req.params.id));
  if (!p || p.childId !== req.session!.childId) throw notFound("Project not found");
  return p;
}

/** Owner or an invited collaborator (a friend building together). */
function editProject(req: Request) {
  const p = getProject(String(req.params.id));
  const childId = req.session!.childId!;
  if (!p || (p.childId !== childId && !isCollaborator(p.id, childId))) throw notFound("Project not found");
  return p;
}

/** When a friend helps build someone else's project, credit them and tell the owner. */
function noteHelp(c: ChildProfile, p: { id: string; childId: string; title: string }, what: string) {
  if (p.childId === c.id) return;
  recordEvent(c.id, "helped", { projectId: p.id });
  addJournal(p.id, "changed", `${c.name} helped: ${what}`);
  notify(p.childId, "🫶", `${c.name} worked on your project “${p.title}”: ${what}`, `/kid/project/${p.id}?tab=history`);
}

/** Code is checked by its words (strings and comments), not its numbers. */
const codeWords = (src: string) => (src.match(/(["'`])(?:\\.|(?!\1).)*\1|\/\/[^\n]*|\/\*[\s\S]*?\*\//g) ?? []).join(" \n ");

/** All strings inside a structure (to safety-check what the child typed into a project). */
const textsOf = (x: unknown): string[] =>
  typeof x === "string" ? [x] : Array.isArray(x) ? x.flatMap(textsOf) : x && typeof x === "object" ? Object.values(x).flatMap(textsOf) : [];

const topicOf = (text: string) => findTopic(text)?.label ?? text.split(/\s+/).slice(0, 3).join(" ").replace(/[^\w\s-]/g, "").slice(0, 30);

// ---------- Home ----------

kidRouter.get(
  "/home",
  h((req) => {
    const c = me(req);
    const count = (sql: string) => one<{ n: number }>(sql, c.id)?.n ?? 0;
    const journey = {
      asked: count("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='asked'") > 0,
      image: count("SELECT COUNT(*) n FROM projects WHERE child_id=? AND type='image'") > 0,
      game: count("SELECT COUNT(*) n FROM projects WHERE child_id=? AND type='game'") > 0,
      played: count("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='game_played'") > 0,
    };
    const notifications = all<{ id: string; emoji: string; text: string; link: string | null; read: number; created_at: string }>(
      "SELECT * FROM notifications WHERE child_id=? ORDER BY created_at DESC LIMIT 20",
      c.id,
    ).map((n) => ({ id: n.id, emoji: n.emoji, text: n.text, link: n.link, read: !!n.read, createdAt: n.created_at }));
    return {
      child: { id: c.id, name: c.name, age: c.age, avatar: c.avatar, interests: c.interests, helpLevel: c.helpLevel, permissions: c.permissions },
      level: creatorLevel(c.id),
      journey,
      notifications,
      projects: listProjects(c.id).slice(0, 8),
    };
  }),
);

kidRouter.patch(
  "/settings",
  h((req) => {
    const c = me(req);
    const b = body(req, z.object({ helpLevel: z.enum(["do", "help", "teach", "challenge"]).optional(), avatar: z.string().max(16).optional() }));
    run("UPDATE children SET help_level=?, avatar=? WHERE id=?", b.helpLevel ?? c.helpLevel, b.avatar ?? c.avatar, c.id);
    return { ok: true };
  }),
);

kidRouter.post(
  "/notifications/read",
  h((req) => {
    run("UPDATE notifications SET read=1 WHERE child_id=?", req.session!.childId!);
    return { ok: true };
  }),
);

// ---------- Chat: Explore, Learn, and project conversations ----------

const Thread = z.string().regex(/^(explore|learn|project:[\w-]+)$/);

kidRouter.get(
  "/chat/:thread",
  h((req) => {
    const thread = Thread.parse(String(req.params.thread));
    return all<{ id: number; role: string; content: string; meta: string | null; created_at: string }>(
      "SELECT * FROM messages WHERE child_id=? AND thread=? ORDER BY id DESC LIMIT 60",
      req.session!.childId!,
      thread,
    )
      .reverse()
      .map((m) => ({ id: m.id, role: m.role, content: m.content, meta: m.meta ? JSON.parse(m.meta) : null, createdAt: m.created_at }));
  }),
);

const ChatBody = z.object({
  thread: Thread,
  message: z.string().max(2000).default(""),
  image: z
    .object({ mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]), data: z.string().max(7_000_000) })
    .optional(),
});

kidRouter.post(
  "/chat",
  h(async (req) => {
    const c = me(req);
    const b = body(req, ChatBody);
    need(c, "aiQuestions", "Asking AI");
    if (b.image) need(c, "photoUpload", "Uploading photos");
    if (!b.message.trim() && !b.image) throw new HttpError(400, "Type a question first!");
    const save = (role: string, content: string, meta: unknown = null) =>
      run("INSERT INTO messages (child_id, thread, role, content, meta, created_at) VALUES (?,?,?,?,?,?)", c.id, b.thread, role, content, meta ? JSON.stringify(meta) : null, now());

    const safety = checkText(b.message, c.age, "input");
    if (safety.verdict === "block" || safety.verdict === "support") {
      recordSafetyEvent(c.id, safety, b.thread, b.message);
      save("user", "🔒 (message hidden by the safety filter)");
      const meta = { safety: true, suggestions: [], certainty: "sure", checkTip: "", followUp: "" };
      save("assistant", safety.childMessage!, meta);
      return { message: { role: "assistant", content: safety.childMessage, meta }, rewards: null };
    }
    if (safety.verdict === "redact") recordSafetyEvent(c.id, safety, b.thread, b.message);
    const text = safety.cleanText;

    const history: ChatTurn[] = all<{ role: "user" | "assistant"; content: string }>(
      "SELECT role, content FROM messages WHERE child_id=? AND thread=? ORDER BY id DESC LIMIT 12",
      c.id,
      b.thread,
    ).reverse();

    let projectContext: string | undefined;
    let mode: "explorer" | "tutor" | "builder" = b.thread === "learn" ? "tutor" : "explorer";
    let projectId: string | null = null;
    if (b.thread.startsWith("project:")) {
      const p = getProject(b.thread.slice(8));
      if (!p || (p.childId !== c.id && !isCollaborator(p.id, c.id))) throw notFound("Project not found");
      projectId = p.id;
      mode = "builder";
      projectContext = `${p.type}: ${JSON.stringify(p.spec).slice(0, 8000)}`;
    }

    const ctx = childContext(c);
    const out = await callAI<ChatReply>("chat", c.id, ctx, c.permissions.dailyAiLimit, (ai) =>
      ai.chat({ ctx, mode, history, message: text, image: b.image, projectContext, webAccess: c.permissions.webAccess }),
    );
    save("user", b.image ? `📷 ${text}` : text);
    const meta = { ...out.data, reply: undefined, note: out.note, privacyTip: safety.childMessage, provider: out.provider };
    save("assistant", out.data.reply, meta);
    recordEvent(c.id, b.thread === "learn" ? "homework" : "asked", {
      projectId,
      topic: out.data.topic,
      data: { q: text.slice(0, 100).toLowerCase() },
    });
    return { message: { role: "assistant", content: out.data.reply, meta }, rewards: after(c.id, projectId) };
  }),
);

// ---------- Create: pictures & stories ----------

kidRouter.post(
  "/create/image",
  h(async (req) => {
    const c = me(req);
    need(c, "imageGeneration", "Making pictures");
    const { prompt } = body(req, z.object({ prompt: z.string().trim().min(2).max(300) }));
    const g = guard(c, prompt, "picture");
    const ctx = childContext(c);
    const out = await callAI("scene", c.id, ctx, c.permissions.dailyAiLimit, (ai) => ai.scene(ctx, g.text));
    const p = createProject(c.id, {
      type: "image",
      idea: g.text,
      description: out.data.caption,
      topic: topicOf(g.text),
      spec: out.data,
      aiHelped: ["arranged the picture", "chose colors and emojis"],
    });
    recordEvent(c.id, "project_created", { projectId: p.id, topic: topicOf(g.text) });
    return { project: p, note: out.note ?? g.tip, rewards: after(c.id, p.id, ["Prompting"]) };
  }),
);

kidRouter.post(
  "/create/story",
  h(async (req) => {
    const c = me(req);
    need(c, "storyCreation", "Writing stories");
    const { prompt } = body(req, z.object({ prompt: z.string().trim().min(2).max(400) }));
    const g = guard(c, prompt, "story");
    const ctx = childContext(c);
    const out = await callAI("story", c.id, ctx, c.permissions.dailyAiLimit, (ai) => ai.story(ctx, g.text));
    const p = createProject(c.id, {
      type: "story",
      idea: g.text,
      description: out.data.moral,
      topic: topicOf(g.text),
      spec: out.data,
      aiHelped: ["wrote the story with your idea", "picked emojis for each page"],
    });
    recordEvent(c.id, "project_created", { projectId: p.id, topic: topicOf(g.text) });
    return { project: p, note: out.note ?? g.tip, rewards: after(c.id, p.id, ["Prompting"]) };
  }),
);

// ---------- Build: games ----------

kidRouter.post(
  "/games",
  h(async (req) => {
    const c = me(req);
    need(c, "gameCreation", "Building games");
    const b = body(req, z.object({ idea: z.string().trim().min(2).max(300), kind: z.enum(GAME_KINDS), topicNotes: z.string().max(600).default("") }));
    const g = guard(c, b.idea, "game idea");
    const ctx = childContext(c);
    const out = await callAI("game", c.id, ctx, c.permissions.dailyAiLimit, (ai) => ai.game(ctx, { idea: g.text, kind: b.kind, topicNotes: b.topicNotes }));
    const p = createProject(c.id, {
      type: "game",
      idea: g.text,
      description: out.data.summary,
      topic: topicOf(`${g.text} ${b.topicNotes}`),
      spec: out.data.spec,
      aiHelped: out.data.aiHelped,
    });
    recordEvent(c.id, "project_created", { projectId: p.id, topic: topicOf(g.text), data: { kind: b.kind } });
    return { project: p, note: out.note ?? g.tip, rewards: after(c.id, p.id, gameConcepts(out.data.spec)) };
  }),
);

// ---------- Make Apps ----------

kidRouter.post(
  "/apps/plan",
  h(async (req) => {
    const c = me(req);
    need(c, "appCreation", "Making apps");
    const { idea } = body(req, z.object({ idea: z.string().trim().min(2).max(300) }));
    const g = guard(c, idea, "app idea");
    const ctx = childContext(c);
    const out = await callAI("appPlan", c.id, ctx, c.permissions.dailyAiLimit, (ai) => ai.appPlan(ctx, g.text));
    const plan = out.data;
    if (!c.permissions.aiGuideInApps) plan.pieces = plan.pieces.filter((p) => !/ai|guide/i.test(p.name));
    return { plan, note: out.note ?? g.tip };
  }),
);

kidRouter.post(
  "/apps",
  h(async (req) => {
    const c = me(req);
    need(c, "appCreation", "Making apps");
    const b = body(req, z.object({ idea: z.string().trim().min(2).max(300), plan: AppPlanSchema }));
    const g = guard(c, `${b.idea} ${b.plan.pieces.map((p) => p.name).join(" ")}`, "app plan");
    const ctx = childContext(c);
    const plan: AppPlan = { ...b.plan, pieces: b.plan.pieces.slice(0, 10) };
    const out = await callAI("app", c.id, ctx, c.permissions.dailyAiLimit, (ai) =>
      ai.app(ctx, { idea: b.idea, plan, allowAiGuide: c.permissions.aiGuideInApps }),
    );
    const p = createProject(c.id, {
      type: "app",
      idea: b.idea,
      description: out.data.summary,
      topic: topicOf(b.idea),
      spec: out.data.spec,
      aiHelped: out.data.aiHelped,
    });
    addJournal(p.id, "changed", `Approved the plan: ${plan.pieces.map((x) => x.name).join(", ")}`);
    recordEvent(c.id, "project_created", { projectId: p.id, topic: topicOf(b.idea) });
    return { project: p, note: out.note ?? g.tip, rewards: after(c.id, p.id, appConcepts(out.data.spec)) };
  }),
);

// ---------- Projects ----------

function checksFor(type: ProjectType, spec: unknown) {
  if (type === "game") return testGame(spec as GameSpec);
  if (type === "app") return testApp(spec as AppSpec);
  return [];
}

kidRouter.get("/projects", h((req) => listProjects(req.session!.childId!)));

kidRouter.get(
  "/projects/:id",
  h((req) => {
    const p = editProject(req);
    const c = me(req);
    return {
      project: p,
      versions: listVersions(p.id),
      journal: getJournal(p.id),
      shares: sharesFor(p.id),
      concepts: p.type === "game" ? gameConcepts(p.spec as GameSpec) : p.type === "app" ? appConcepts(p.spec as AppSpec) : p.type === "code" ? ["Variables", "Events", "Conditions", "Functions"] : [],
      permissions: c.permissions,
      role: p.childId === c.id ? "owner" : "collaborator",
      owner: p.childId === c.id ? null : getChild(p.childId)?.name ?? null,
      collaborators: collaboratorsOf(p.id),
      tasks: tasksOf(p.id),
      reactions: reactionsOf(p.id),
      deployment: one("SELECT repo, repo_url AS repoUrl, pages_url AS pagesUrl, version, updated_at AS updatedAt FROM deployments WHERE project_id=?", p.id) ?? null,
      githubReady: c.permissions.github && !!one("SELECT 1 FROM connectors WHERE family_id=? AND kind='github'", c.familyId),
    };
  }),
);

kidRouter.get(
  "/projects/:id/versions/:v",
  h((req) => {
    const p = editProject(req);
    const spec = getVersionSpec(p.id, Number(req.params.v));
    if (!spec) throw notFound("Version not found");
    return { spec };
  }),
);

kidRouter.delete(
  "/projects/:id",
  h((req) => {
    const p = ownProject(req);
    deleteProject(p.id);
    return { ok: true };
  }),
);

/** Ask AI to change a project. */
kidRouter.post(
  "/projects/:id/ai-change",
  h(async (req) => {
    const c = me(req);
    const p = editProject(req);
    const { request } = body(req, z.object({ request: z.string().trim().min(2).max(400) }));
    const g = guard(c, request, "change request");
    const ctx = childContext(c);
    let next: unknown;
    let summary = "";
    let explanation = "";
    let concept = "";
    let note: string | undefined;
    if (p.type === "game") {
      need(c, "gameCreation", "Building games");
      const out = await callAI("modifyGame", c.id, ctx, c.permissions.dailyAiLimit, (ai) => ai.modifyGame(ctx, p.spec as GameSpec, g.text));
      if (!out.data.understood) return { understood: false, explanation: out.data.explanation, note: out.note };
      ({ summary, explanation, concept } = out.data);
      next = out.data.spec;
      note = out.note;
    } else if (p.type === "app") {
      need(c, "appCreation", "Making apps");
      const out = await callAI("modifyApp", c.id, ctx, c.permissions.dailyAiLimit, (ai) =>
        ai.modifyApp(ctx, p.spec as AppSpec, g.text, c.permissions.aiGuideInApps),
      );
      if (!out.data.understood) return { understood: false, explanation: out.data.explanation, note: out.note };
      ({ summary, explanation, concept } = out.data);
      next = out.data.spec;
      note = out.note;
    } else if (p.type === "code") {
      need(c, "codeMode", "Code Mode");
      const code = p.spec as CodeSpec;
      const error = typeof req.body?.error === "string" ? req.body.error.slice(0, 500) : undefined;
      const out = await callAI("modifyCode", c.id, ctx, c.permissions.dailyAiLimit, (ai) => ai.modifyCode(ctx, code.source, g.text, error));
      if (!out.data.understood) return { understood: false, explanation: out.data.explanation, note: out.note };
      ({ summary, explanation, concept } = out.data);
      next = normalizeCode({ ...code, source: out.data.source });
      note = out.note;
    } else if (p.type === "image") {
      need(c, "imageGeneration", "Making pictures");
      const prev = p.spec as SceneSpec;
      const out = await callAI("scene", c.id, ctx, c.permissions.dailyAiLimit, (ai) =>
        ai.scene(ctx, `${p.idea}. Change: ${g.text}. (Previous picture: ${prev.caption})`),
      );
      next = out.data;
      summary = `Redrew it: ${g.text}`;
      explanation = "I used your original idea plus your change as a new, more detailed prompt.";
      concept = "Prompting";
      note = out.note;
    } else {
      need(c, "storyCreation", "Writing stories");
      const prev = p.spec as StorySpec;
      const out = await callAI("story", c.id, ctx, c.permissions.dailyAiLimit, (ai) =>
        ai.story(ctx, `${p.idea}. Rewrite of “${prev.title}” with this change: ${g.text}`),
      );
      next = out.data;
      summary = `Rewrote it: ${g.text}`;
      explanation = "I rewrote the story using your idea plus your change.";
      concept = "Prompting";
      note = out.note;
    }
    const before = checksFor(p.type, p.spec).filter((x) => !x.passed).map((x) => x.id);
    const saved = saveVersion(p.id, next as GameSpec, summary, "ai", c.name);
    addJournal(p.id, "changed", `Asked AI: “${g.text}”`);
    addJournal(p.id, "ai", summary);
    noteHelp(c, p, summary);
    recordEvent(c.id, "modified", { projectId: p.id, topic: p.topic, data: { by: "ai" } });
    const aiChanges = one<{ n: number }>("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='modified' AND json_extract(data,'$.by')='ai'", c.id)!.n;
    const concepts = [concept, ...(aiChanges >= 3 ? ["AI Prompting"] : [])].filter(Boolean);
    // New problems introduced by the change become a debugging opportunity.
    const newBugs = checksFor(p.type, next).filter((x) => !x.passed && !before.includes(x.id));
    return { understood: true, project: saved, summary, explanation, concept, newBugs, note: note ?? g.tip, rewards: after(c.id, p.id, concepts) };
  }),
);

/** The child edits the project directly in BUILD mode. */
kidRouter.put(
  "/projects/:id/spec",
  h((req) => {
    const c = me(req);
    const p = editProject(req);
    const raw = (req.body ?? {}).spec;
    let next: unknown;
    let changes: string[] = [];
    if (p.type === "game") {
      const parsed = GameSpecInput.safeParse(raw);
      if (!parsed.success) throw new HttpError(400, "That game data doesn't look right.");
      next = normalizeGame(parsed.data);
      changes = diffGames(p.spec as GameSpec, next as GameSpec);
    } else if (p.type === "app") {
      const parsed = AppSpecInput.safeParse(raw);
      if (!parsed.success) throw new HttpError(400, "That app data doesn't look right.");
      const a = normalizeApp(parsed.data);
      if (!c.permissions.aiGuideInApps) for (const s of a.screens) s.blocks = s.blocks.filter((b) => b.type !== "aiGuide");
      next = a;
      changes = diffApps(p.spec as AppSpec, a);
    } else if (p.type === "image") {
      const parsed = SceneSpec.safeParse(raw);
      if (!parsed.success) throw new HttpError(400, "That picture data doesn't look right.");
      next = normalizeScene(parsed.data);
      changes = ["Rearranged the picture"];
    } else if (p.type === "code") {
      need(c, "codeMode", "Code Mode");
      const parsed = CodeSpec.safeParse(raw);
      if (!parsed.success) throw new HttpError(400, "That code data doesn't look right.");
      next = normalizeCode(parsed.data);
      const before = (p.spec as CodeSpec).source.split("\n");
      const after = (next as CodeSpec).source.split("\n");
      const changed = after.filter((l, i) => l !== before[i]).length + Math.max(0, before.length - after.length);
      changes = [`Changed ${changed} line${changed === 1 ? "" : "s"} of code`];
    } else {
      const parsed = StorySpec.safeParse(raw);
      if (!parsed.success) throw new HttpError(400, "That story data doesn't look right.");
      next = normalizeStory(parsed.data);
      changes = ["Edited the story"];
    }
    if (JSON.stringify(next) === JSON.stringify(p.spec)) return { project: p, unchanged: true };
    // Children's own words become visible on share pages, so they pass the safety filter too.
    const texts = p.type === "code" ? `${(next as CodeSpec).title} \n ${codeWords((next as CodeSpec).source)}` : textsOf(next).join(" \n ");
    const s = checkText(texts, c.age, "input");
    if (s.verdict === "block" || s.verdict === "support") {
      recordSafetyEvent(c.id, s, "project edit", texts.slice(0, 200));
      throw new HttpError(422, s.childMessage!);
    }
    if (s.verdict === "redact") {
      recordSafetyEvent(c.id, s, "project edit", texts.slice(0, 200));
      throw new HttpError(422, "🔒 It looks like there's personal info in your project (like an address, phone number or school). Please take it out before saving.");
    }
    const before = checksFor(p.type, p.spec).filter((x) => !x.passed);
    const afterChecks = checksFor(p.type, next);
    const solved = before.filter((b) => afterChecks.find((a) => a.id === b.id)?.passed);
    const summary = (req.body?.summary as string | undefined)?.slice(0, 200) || changes.join(", ") || "Edited by me";
    const saved = saveVersion(p.id, next as GameSpec, summary, "child", c.name);
    for (const line of changes.slice(0, 6)) addJournal(p.id, "changed", line);
    noteHelp(c, p, summary);
    recordEvent(c.id, "modified", { projectId: p.id, topic: p.topic, data: { by: "child" } });
    const concepts: string[] = [];
    for (const bug of solved) {
      addJournal(p.id, "solved", `Fixed it myself: ${bug.bug!.title.replace(/^🐛\s*/, "")}`);
      recordEvent(c.id, "bug_fixed", { projectId: p.id, topic: p.topic, data: { how: "manual", bug: bug.bug!.id } });
      concepts.push("Debugging", bug.bug!.concept);
    }
    if (p.type === "game") concepts.push(...gameConcepts(next as GameSpec));
    if (p.type === "app") concepts.push(...appConcepts(next as AppSpec));
    return { project: saved, solved: solved.map((b) => b.bug), rewards: after(c.id, p.id, concepts) };
  }),
);

kidRouter.post(
  "/projects/:id/test",
  h((req) => {
    const c = me(req);
    const p = editProject(req);
    if (p.type !== "game" && p.type !== "app") throw new HttpError(400, "Only games and apps have tests.");
    const checks = checksFor(p.type, p.spec);
    recordEvent(c.id, "tested", { projectId: p.id, topic: p.topic, data: { failed: checks.filter((x) => !x.passed).length } });
    return { checks, rewards: after(c.id, p.id, ["Testing"]) };
  }),
);

kidRouter.post(
  "/projects/:id/fix",
  h((req) => {
    const c = me(req);
    const p = editProject(req);
    const { bugId } = body(req, z.object({ bugId: z.string().max(40) }));
    const bug = checksFor(p.type, p.spec).find((x) => x.bug?.id === bugId)?.bug;
    if (!bug) throw new HttpError(400, "That bug is already fixed! 🎉");
    const next = p.type === "game" ? autoFixGame(p.spec as GameSpec, bugId) : autoFixApp(p.spec as AppSpec, bugId);
    const saved = saveVersion(p.id, next, `Fixed: ${bug.title.replace(/^🐛\s*/, "")}`, "fix", c.name);
    addJournal(p.id, "solved", `Fixed with AI: ${bug.title.replace(/^🐛\s*/, "")}`);
    recordEvent(c.id, "bug_fixed", { projectId: p.id, topic: p.topic, data: { how: "auto", bug: bugId } });
    return { project: saved, rewards: after(c.id, p.id, ["Debugging", bug.concept]) };
  }),
);

kidRouter.post(
  "/projects/:id/played",
  h((req) => {
    const c = me(req);
    const p = editProject(req);
    const b = body(req, z.object({ result: z.enum(["won", "lost", "quit"]), score: z.number().int().min(-100000).max(1000000).default(0) }));
    recordEvent(c.id, "game_played", { projectId: p.id, topic: p.topic, data: { result: b.result, score: b.score } });
    return { rewards: after(c.id, p.id) };
  }),
);

kidRouter.post(
  "/projects/:id/restore",
  h((req) => {
    const c = me(req);
    const p = editProject(req);
    const { version } = body(req, z.object({ version: z.number().int().min(1) }));
    const spec = getVersionSpec(p.id, version);
    if (!spec) throw notFound("Version not found");
    const saved = saveVersion(p.id, spec, `Went back to version ${version}`, "child", c.name);
    addJournal(p.id, "changed", `Went back to version ${version}`);
    recordEvent(c.id, "restored", { projectId: p.id, data: { version } });
    return { project: saved, rewards: after(c.id, p.id, ["Version Control"]) };
  }),
);

kidRouter.post(
  "/projects/:id/explain",
  h(async (req) => {
    const c = me(req);
    const p = editProject(req);
    const { text } = body(req, z.object({ text: z.string().trim().min(3).max(1500) }));
    const g = guard(c, text, "explanation");
    const ctx = childContext(c);
    const out = await callAI("understand", c.id, ctx, c.permissions.dailyAiLimit, (ai) =>
      ai.checkUnderstanding(ctx, `${p.type} “${p.title}”: ${JSON.stringify(p.spec).slice(0, 6000)}`, g.text),
    );
    addJournal(p.id, "learned", `In my own words: ${g.text}`);
    recordEvent(c.id, "explained", { projectId: p.id, data: { understood: out.data.understood ? 1 : 0 } });
    return { ...out.data, note: out.note, rewards: after(c.id, p.id) };
  }),
);

kidRouter.post(
  "/projects/:id/journal",
  h((req) => {
    const c = me(req);
    const p = editProject(req);
    const b = body(req, z.object({ kind: z.enum(["learned", "changed", "solved", "idea"]), text: z.string().trim().min(2).max(300) }));
    const g = guard(c, b.text, "journal");
    addJournal(p.id, b.kind, g.text);
    return { journal: getJournal(p.id), note: g.tip };
  }),
);

kidRouter.post(
  "/projects/:id/code-viewed",
  h((req) => {
    const c = me(req);
    const p = editProject(req);
    const seen = one("SELECT 1 FROM events WHERE child_id=? AND type='code_viewed' AND project_id=?", c.id, p.id);
    if (!seen) recordEvent(c.id, "code_viewed", { projectId: p.id });
    return { rewards: after(c.id, p.id, ["Data"]) };
  }),
);

// ---------- Code Mode ----------

kidRouter.post(
  "/code",
  h((req) => {
    const c = me(req);
    need(c, "codeMode", "Code Mode");
    const { title } = body(req, z.object({ title: z.string().trim().max(60).default("") }));
    const g = guard(c, title || "My code game", "code title");
    const p = createProject(c.id, {
      type: "code",
      idea: "Write a game in real JavaScript",
      description: "A game written in JavaScript on the SparkForge engine.",
      topic: "code",
      spec: normalizeCode({ title: g.text || "My code game", emoji: "⌨️", source: STARTER_CODE }),
      aiHelped: ["wrote a starter program to build on"],
    });
    recordEvent(c.id, "project_created", { projectId: p.id, topic: "code" });
    return { project: p, rewards: after(c.id, p.id, ["Variables", "Events", "Functions"]) };
  }),
);

/** "Open in Code Mode": turn a game into real JavaScript the child can edit. */
kidRouter.post(
  "/projects/:id/eject",
  h((req) => {
    const c = me(req);
    need(c, "codeMode", "Code Mode");
    const src = editProject(req);
    if (src.type !== "game") throw new HttpError(400, "Only games can be turned into code.");
    const spec = src.spec as GameSpec;
    const p = createProject(c.id, {
      type: "code",
      idea: `“${spec.title}” as real code`,
      description: src.description,
      topic: src.topic,
      spec: normalizeCode({ title: `${spec.title} (code)`, emoji: spec.player.emoji, source: ejectGame(spec) }),
      aiHelped: ["turned the game into JavaScript you can change"],
    });
    recordEvent(c.id, "project_created", { projectId: p.id, topic: src.topic });
    return { project: p, rewards: after(c.id, p.id, ["Functions", "Events", "Variables"]) };
  }),
);

kidRouter.post(
  "/projects/:id/ran",
  h((req) => {
    const c = me(req);
    const p = editProject(req);
    const b = body(req, z.object({ ok: z.boolean(), error: z.string().max(300).default("") }));
    recordEvent(c.id, "code_ran", { projectId: p.id, data: { ok: b.ok ? 1 : 0 } });
    return { rewards: after(c.id, p.id, b.ok ? [] : ["Debugging"]) };
  }),
);

/** Download a project as a single web page that works anywhere. */
kidRouter.get("/projects/:id/export", (req, res, next) => {
  try {
    const p = editProject(req);
    const owner = getChild(p.childId)!;
    const html = projectHtml(p, owner.permissions.showCreatorName ? owner.name : "a young creator");
    if (!html) throw new HttpError(400, "This kind of project can't be downloaded yet.");
    const file = `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project"}.html`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
    res.send(html);
  } catch (e) {
    next(e);
  }
});

// ---------- Sharing ----------

kidRouter.post(
  "/projects/:id/share",
  h(async (req) => {
    const c = me(req);
    const p = ownProject(req);
    const b = body(req, z.object({ audience: z.enum(["family", "friends", "public"]), allowRemix: z.boolean().default(false) }));
    const permFor: Record<Audience, keyof Permissions> = { family: "projectSharing", friends: "friendSharing", public: "publicPublishing" };
    need(c, permFor[b.audience], b.audience === "public" ? "Public publishing" : b.audience === "friends" ? "Sharing with friends" : "Sharing");
    const allowRemix = b.allowRemix && c.permissions.friendRemix;
    if (b.audience === "public") {
      const text = `${p.title}. ${p.description}`;
      const local = checkText(text, c.age, "input");
      if (local.verdict !== "allow") throw new HttpError(422, "Your project's title or description needs a change before it can be public (no personal info, kind words only).");
      const ctx = childContext(c);
      const mod = await callAI("moderate", c.id, ctx, null, (ai) => ai.moderate(text));
      if (!mod.data.safe) throw new HttpError(422, `Before publishing: ${mod.data.reason}`);
    }
    const existing = one<{ token: string; status: string }>(
      "SELECT token, status FROM shares WHERE project_id=? AND audience=? AND status<>'revoked'",
      p.id,
      b.audience,
    );
    if (existing) {
      run("UPDATE shares SET allow_remix=? WHERE token=?", allowRemix ? 1 : 0, existing.token);
      return { token: existing.token, pending: existing.status === "pending", shares: sharesFor(p.id), rewards: null };
    }
    const token = createShare(c.id, p.id, b.audience, allowRemix, c.permissions.shareNeedsApproval);
    const pending = c.permissions.shareNeedsApproval;
    const rewards = pending ? null : activateShare(token);
    return { token, pending, shares: sharesFor(p.id), rewards };
  }),
);

kidRouter.get(
  "/contacts",
  h((req) => {
    const c = me(req);
    if (!c.permissions.emailSharing) return [];
    return all<{ id: string; name: string }>("SELECT id, name FROM contacts WHERE family_id=? ORDER BY name", req.session!.familyId);
  }),
);

kidRouter.post(
  "/remix/:token",
  h((req) => {
    const c = me(req);
    const share = activeShare(String(req.params.token));
    const src = getProject(share.project_id);
    const owner = getChild(share.child_id);
    if (!src || !owner) throw notFound();
    if (!share.allow_remix || !owner.permissions.friendRemix) throw forbid("This creation can't be remixed.");
    if (owner.id === c.id) throw new HttpError(400, "That's already yours! Open it from My Creations.");
    const perm: Record<ProjectType, keyof Permissions> = { game: "gameCreation", app: "appCreation", image: "imageGeneration", story: "storyCreation", code: "codeMode" };
    need(c, perm[src.type], "Making this kind of project");
    const p = createProject(c.id, {
      type: src.type,
      idea: `Remix of “${src.title}”`,
      description: src.description,
      topic: src.topic,
      spec: src.spec,
      remixedFrom: src.id,
    });
    recordEvent(c.id, "remixed", { projectId: p.id });
    recordEvent(owner.id, "remixed_by_other", { projectId: src.id });
    notify(owner.id, "🎉", `A friend remixed your ${src.type} “${src.title}”!`, `/kid/project/${src.id}?tab=share`);
    evaluate(owner.id, src.id);
    return { project: p, rewards: after(c.id, p.id) };
  }),
);

// ---------- App AI guide ----------

kidRouter.post(
  "/guide/:id",
  h(async (req) => {
    const c = me(req);
    const p = editProject(req);
    need(c, "aiGuideInApps", "AI guides in apps");
    need(c, "aiQuestions", "Asking AI");
    if (p.type !== "app") throw new HttpError(400, "Only apps have guides.");
    const { question } = body(req, z.object({ question: z.string().trim().min(1).max(500) }));
    const g = guard(c, question, "app guide");
    const spec = p.spec as AppSpec;
    const block = spec.screens.flatMap((s) => s.blocks).find((b) => b.type === "aiGuide");
    if (!block) throw new HttpError(400, "This app doesn't have an AI Guide block.");
    const ctx = childContext(c);
    const data = spec.collections.map((col) => `${col.name}: ${col.items.map((i) => `${i.title} (${i.subtitle})`).join("; ")}`).join("\n");
    const out = await callAI("guide", c.id, ctx, c.permissions.dailyAiLimit, (ai) =>
      ai.chat({ ctx, mode: "appGuide", history: [], message: g.text, persona: block.text, projectContext: `App “${spec.title}”: ${spec.description}\n${data}` }),
    );
    recordEvent(c.id, "asked", { projectId: p.id, topic: out.data.topic, data: { q: g.text.slice(0, 100).toLowerCase(), guide: 1 } });
    return { reply: out.data.reply, certainty: out.data.certainty, note: out.note ?? g.tip, rewards: after(c.id, p.id, ["AI Models"]) };
  }),
);

// ---------- AI Detective ----------

kidRouter.post(
  "/detective",
  h(async (req) => {
    const c = me(req);
    need(c, "aiQuestions", "Asking AI");
    const { topic } = body(req, z.object({ topic: z.string().max(60).default("") }));
    const g = guard(c, topic, "detective topic");
    const ctx = childContext(c);
    const out = await callAI("detective", c.id, ctx, c.permissions.dailyAiLimit, (ai) => ai.detective(ctx, g.text || c.interests.join(", ")));
    if (out.data.statements.length !== 3) throw new HttpError(502, "The case files got mixed up. Try again!");
    const id = newId("case");
    run("INSERT INTO detective_cases (id, child_id, data, created_at) VALUES (?,?,?,?)", id, c.id, JSON.stringify(out.data), now());
    return { id, topic: out.data.topic, statements: out.data.statements, note: out.note };
  }),
);

kidRouter.post(
  "/detective/:caseId/answer",
  h((req) => {
    const c = me(req);
    const row = one<{ data: string; solved: number }>("SELECT data, solved FROM detective_cases WHERE id=? AND child_id=?", String(req.params.caseId), c.id);
    if (!row) throw notFound("Case not found");
    const { index } = body(req, z.object({ index: z.number().int().min(0).max(2) }));
    const data = JSON.parse(row.data) as { wrong: number; correction: string; topic: string };
    const correct = index === data.wrong;
    if (!row.solved) {
      run("UPDATE detective_cases SET solved=1 WHERE id=?", String(req.params.caseId));
      recordEvent(c.id, correct ? "detective_solved" : "detective_missed", { topic: data.topic });
    }
    return { correct, wrong: data.wrong, correction: data.correction, rewards: after(c.id, null, ["AI Verification", "AI Models"]) };
  }),
);

// ---------- Progress ----------

kidRouter.get("/missions", h((req) => missionProgress(req.session!.childId!)));

kidRouter.get(
  "/passport",
  h((req) => {
    const c = me(req);
    return { name: c.name, avatar: c.avatar, ...passport(c.id) };
  }),
);
