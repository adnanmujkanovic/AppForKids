// AI agents, the daily planner, and connectors (GitHub, email).
import { Router, type Request } from "express";
import { z } from "zod";
import { all, newId, now, one, run } from "../db";
import { requireChild, requireParent } from "../auth";
import { body, forbid, h, HttpError, notFound } from "../http";
import { callAI } from "../ai/gateway";
import { childContext, getChild } from "../engines/children";
import { getProject, listVersions } from "../engines/projects";
import { evaluate, recordEvent } from "../engines/progress";
import { settleMissions } from "../engines/missions";
import { isCollaborator } from "../engines/social";
import { EXPORTABLE, projectHtml } from "../engines/exporter";
import { checkText, recordSafetyEvent } from "../safety";
import { seal, unseal } from "../secrets";
import { deploy, githubUser } from "../connectors/github";
import { emailEnabled, sendEmail } from "../connectors/email";
import { activeShare } from "./shares";
import type { ChildProfile, Permissions } from "../../shared/types";

export const kidExtrasRouter = Router();
export const parentExtrasRouter = Router();
kidExtrasRouter.use(requireChild);
parentExtrasRouter.use(requireParent);

const me = (req: Request) => {
  const c = getChild(req.session!.childId!);
  if (!c) throw new HttpError(401, "Profile not found");
  return c;
};
function need(c: ChildProfile, key: keyof Permissions, what: string) {
  if (!c.permissions[key]) throw forbid(`${what} is turned off in your family settings. Ask a parent if you'd like to try it!`);
}
function guard(c: ChildProfile, text: string, source: string) {
  const r = checkText(text, c.age);
  if (r.verdict === "allow") return text;
  recordSafetyEvent(c.id, r, source, text);
  if (r.verdict === "redact") return r.cleanText;
  throw new HttpError(422, r.childMessage!);
}
function teamProject(req: Request) {
  const p = getProject(String(req.params.id));
  const self = req.session!.childId!;
  if (!p || (p.childId !== self && !isCollaborator(p.id, self))) throw notFound("Project not found");
  return p;
}

// ---------- AI agent: plan → child approves → client runs each step as an AI change ----------

kidExtrasRouter.post(
  "/projects/:id/agent/plan",
  h(async (req) => {
    const c = me(req);
    need(c, "aiAgents", "AI agents");
    const p = teamProject(req);
    if (p.type !== "game" && p.type !== "app") throw new HttpError(400, "Agents can build games and apps.");
    const goal = guard(c, body(req, z.object({ goal: z.string().trim().min(3).max(300) })).goal, "agent goal");
    const ctx = childContext(c);
    const out = await callAI("agentPlan", c.id, ctx, c.permissions.dailyAiLimit, (ai) => ai.agentPlan(ctx, p.type as "game" | "app", p.spec, goal));
    recordEvent(c.id, "agent_run", { projectId: p.id });
    return { plan: out.data, note: out.note };
  }),
);

// ---------- Daily-life planner ----------

const StepsBody = z.array(z.object({ text: z.string().trim().min(1).max(160), when: z.string().max(40), done: z.boolean() })).max(15);

kidExtrasRouter.get(
  "/plans",
  h((req) =>
    all<{ id: string; title: string; steps: string; updated_at: string }>(
      "SELECT id, title, steps, updated_at FROM plans WHERE child_id=? ORDER BY updated_at DESC LIMIT 30",
      req.session!.childId!,
    ).map((p) => ({ id: p.id, title: p.title, steps: JSON.parse(p.steps), updatedAt: p.updated_at })),
  ),
);

kidExtrasRouter.post(
  "/plans",
  h(async (req) => {
    const c = me(req);
    need(c, "aiQuestions", "Asking AI");
    const goal = guard(c, body(req, z.object({ goal: z.string().trim().min(3).max(200) })).goal, "planner");
    const ctx = childContext(c);
    const out = await callAI("dayPlan", c.id, ctx, c.permissions.dailyAiLimit, (ai) => ai.dayPlan(ctx, goal));
    const id = newId("pln");
    const steps = out.data.steps.map((s) => ({ ...s, done: false }));
    run("INSERT INTO plans (id, child_id, title, steps, created_at, updated_at) VALUES (?,?,?,?,?,?)", id, c.id, out.data.title.slice(0, 80), JSON.stringify(steps), now(), now());
    recordEvent(c.id, "planned");
    return { plan: { id, title: out.data.title, steps, tip: out.data.tip }, note: out.note };
  }),
);

kidExtrasRouter.put(
  "/plans/:planId",
  h((req) => {
    const c = me(req);
    const b = body(req, z.object({ title: z.string().trim().min(1).max(80), steps: StepsBody }));
    for (const s of [b.title, ...b.steps.map((x) => x.text)]) guard(c, s, "planner");
    const r = run("UPDATE plans SET title=?, steps=?, updated_at=? WHERE id=? AND child_id=?", b.title, JSON.stringify(b.steps), now(), String(req.params.planId), c.id);
    if (!r.changes) throw notFound("Plan not found");
    return { ok: true };
  }),
);

kidExtrasRouter.delete(
  "/plans/:planId",
  h((req) => {
    run("DELETE FROM plans WHERE id=? AND child_id=?", String(req.params.planId), req.session!.childId!);
    return { ok: true };
  }),
);

// ---------- GitHub (parent connects; child saves & deploys) ----------

parentExtrasRouter.get(
  "/connectors",
  h((req) => {
    const gh = one<{ account: string; created_at: string }>("SELECT account, created_at FROM connectors WHERE family_id=? AND kind='github'", req.session!.familyId);
    return { github: gh ? { account: gh.account, connectedAt: gh.created_at } : null, email: { smtp: emailEnabled() } };
  }),
);

parentExtrasRouter.post(
  "/connectors/github",
  h(async (req) => {
    const { token } = body(req, z.object({ token: z.string().trim().min(20).max(300) }));
    const login = await githubUser(token);
    run(
      "INSERT OR REPLACE INTO connectors (family_id, kind, account, secret, created_at) VALUES (?,?,?,?,?)",
      req.session!.familyId, "github", login, seal(token), now(),
    );
    return { account: login };
  }),
);

parentExtrasRouter.delete(
  "/connectors/github",
  h((req) => {
    run("DELETE FROM connectors WHERE family_id=? AND kind='github'", req.session!.familyId);
    return { ok: true };
  }),
);

const repoName = (title: string) => `sparkforge-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "project"}`;

kidExtrasRouter.post(
  "/projects/:id/deploy",
  h(async (req) => {
    const c = me(req);
    need(c, "github", "GitHub");
    const p = getProject(String(req.params.id));
    if (!p || p.childId !== c.id) throw notFound("Project not found");
    if (!EXPORTABLE.has(p.type)) throw new HttpError(400, "Games, apps and code projects can go on GitHub.");
    const conn = one<{ account: string; secret: string }>("SELECT account, secret FROM connectors WHERE family_id=? AND kind='github'", c.familyId);
    if (!conn) throw new HttpError(400, "Ask a grown-up to connect GitHub in the parent area first.");
    // Titles and descriptions become public on GitHub, so they must pass the safety check.
    const text = `${p.title}. ${p.description}`;
    if (checkText(text, c.age).verdict !== "allow") throw new HttpError(422, "Your project's title or description needs a change first (no personal info).");
    const creator = c.permissions.showCreatorName ? c.name : "a young creator";
    const html = projectHtml(p, creator)!;
    const latest = listVersions(p.id)[0];
    const existing = one<{ repo: string }>("SELECT repo FROM deployments WHERE project_id=?", p.id);
    const repo = existing?.repo ?? repoName(p.title);
    const isPublic = c.permissions.publicPublishing;
    const readme = `# ${p.emoji} ${p.title}\n\n${p.description || p.idea}\n\nMade by ${creator} with SparkForge Kids.\n\n${
      isPublic ? `▶ Play it: https://${conn.account.toLowerCase()}.github.io/${repo}/\n` : ""
    }\n## Versions\n\n${listVersions(p.id).slice(0, 20).map((v) => `- v${v.version}: ${v.summary}`).join("\n")}\n`;
    const out = await deploy({
      token: unseal(conn.secret),
      owner: conn.account,
      repo,
      description: `${p.title} — made with SparkForge Kids`,
      isPublic,
      files: { "index.html": html, "README.md": readme },
      message: `v${latest?.version ?? p.version}: ${latest?.summary ?? "Update"}`,
      create: !existing,
    });
    run(
      "INSERT OR REPLACE INTO deployments (project_id, repo, repo_url, pages_url, version, updated_at) VALUES (?,?,?,?,?,?)",
      p.id, repo, out.repoUrl, out.pagesUrl, p.version, now(),
    );
    recordEvent(c.id, "deployed", { projectId: p.id, data: { public: isPublic ? 1 : 0 } });
    settleMissions(c.id);
    return { ...out, repo, isPublic, commit: `v${latest?.version ?? p.version}: ${latest?.summary ?? "Update"}`, rewards: evaluate(c.id, p.id, ["Repositories", "Version Control", ...(isPublic ? ["Deployment"] : [])]) };
  }),
);

// ---------- Email to approved contacts ----------

kidExtrasRouter.post(
  "/projects/:id/email",
  h(async (req) => {
    const c = me(req);
    need(c, "emailSharing", "Sending to contacts");
    const p = getProject(String(req.params.id));
    if (!p || p.childId !== c.id) throw notFound("Project not found");
    const b = body(req, z.object({ contactId: z.string(), token: z.string(), message: z.string().max(300).default("") }));
    const contact = one<{ id: string; name: string; email: string }>("SELECT id, name, email FROM contacts WHERE id=? AND family_id=?", b.contactId, c.familyId);
    if (!contact) throw notFound("Contact not found");
    const share = activeShare(b.token);
    if (share.project_id !== p.id) throw forbid("That link is for a different project.");
    const msg = b.message ? guard(c, b.message, "message to contact") : "";
    const base = process.env.PUBLIC_URL ?? `${req.protocol}://${req.get("host")}`;
    const subject = `${c.name} made something: ${p.title}`;
    const text = `${msg ? `${msg}\n\n` : ""}${c.name} made “${p.title}” with SparkForge Kids and wants to show you!\n\nOpen it here: ${base}/s/${b.token}\n`;
    const status = await sendEmail(contact.email, subject, text);
    run(
      "INSERT INTO outbox (id, family_id, child_id, contact_id, subject, body, status, created_at) VALUES (?,?,?,?,?,?,?,?)",
      newId("out"), c.familyId, c.id, contact.id, subject, text, status, now(),
    );
    return { ok: status !== "failed", status, to: contact.name };
  }),
);
