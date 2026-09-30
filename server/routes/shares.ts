// Sharing: private links first, approved friends next, controlled public publishing last.
import { Router } from "express";
import { all, newToken, now, one, run } from "../db";
import { h, notFound } from "../http";
import { getChild } from "../engines/children";
import { getJournal, getProject } from "../engines/projects";
import { evaluate, notify, recordEvent } from "../engines/progress";
import { settleMissions } from "../engines/missions";
import { gameConcepts, type GameSpec } from "../../shared/game";
import { appConcepts, type AppSpec } from "../../shared/app";

export const shareRouter = Router();

export type Audience = "family" | "friends" | "public";

interface ShareRow {
  token: string;
  project_id: string;
  child_id: string;
  audience: Audience;
  allow_remix: number;
  status: "active" | "pending" | "revoked";
  slug: string | null;
  views: number;
  plays: number;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "project";

export function createShare(childId: string, projectId: string, audience: Audience, allowRemix: boolean, needsApproval: boolean) {
  const p = getProject(projectId)!;
  const child = getChild(childId)!;
  const token = newToken().slice(0, 16);
  let slug: string | null = null;
  if (audience === "public") {
    const who = child.permissions.showCreatorName ? slugify(child.name) : "creator";
    slug = `${who}/${slugify(p.title)}`;
    for (let i = 2; one("SELECT 1 FROM shares WHERE slug=? AND status<>'revoked'", slug); i++) slug = `${who}/${slugify(p.title)}-${i}`;
  }
  run(
    "INSERT INTO shares (token, project_id, child_id, audience, allow_remix, status, version, slug, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    token, projectId, childId, audience, allowRemix ? 1 : 0, needsApproval ? "pending" : "active", p.version, slug, now(),
  );
  return token;
}

/** Turns a share on and credits the child. Used directly or after parent approval. */
export function activateShare(token: string) {
  const s = one<ShareRow>("SELECT * FROM shares WHERE token=?", token)!;
  const wasPending = s.status === "pending";
  run("UPDATE shares SET status='active' WHERE token=?", token);
  recordEvent(s.child_id, "shared", { projectId: s.project_id, data: { audience: s.audience } });
  if (s.audience === "public") recordEvent(s.child_id, "published", { projectId: s.project_id });
  if (wasPending) notify(s.child_id, "✅", "A grown-up approved your share link!", `/kid/project/${s.project_id}?tab=share`);
  settleMissions(s.child_id);
  return evaluate(s.child_id, s.project_id);
}

export function sharesFor(projectId: string) {
  return all<ShareRow & { created_at: string }>("SELECT * FROM shares WHERE project_id=? AND status<>'revoked' ORDER BY created_at DESC", projectId).map((s) => ({
    token: s.token,
    audience: s.audience,
    status: s.status,
    allowRemix: !!s.allow_remix,
    slug: s.slug,
    views: s.views,
    plays: s.plays,
    createdAt: s.created_at,
  }));
}

/** What a share page shows. Minimal identity: first name only, if the parent allows it. */
function sharePayload(s: ShareRow) {
  const p = getProject(s.project_id);
  const child = getChild(s.child_id);
  if (!p || !child) return null;
  const journal = getJournal(p.id);
  const skills = all<{ concept: string }>("SELECT concept FROM skills WHERE project_id=?", p.id).map((r) => r.concept);
  const concepts = p.type === "game" ? gameConcepts(p.spec as GameSpec) : p.type === "app" ? appConcepts(p.spec as AppSpec) : [];
  // AI guide blocks never run for anonymous viewers.
  let spec = p.spec;
  if (p.type === "app") {
    const a = structuredClone(p.spec as AppSpec);
    a.screens.forEach((sc) => sc.blocks.forEach((b) => b.type === "aiGuide" && (b.text = "__disabled__")));
    spec = a;
  }
  return {
    token: s.token,
    type: p.type,
    title: p.title,
    emoji: p.emoji,
    idea: p.idea,
    description: p.description,
    spec,
    version: p.version,
    creator: child.permissions.showCreatorName ? child.name : "a young creator",
    learned: [...new Set([...skills, ...concepts, ...journal.filter((j) => j.kind === "learned").map((j) => j.text)])].slice(0, 8),
    aiHelped: journal.filter((j) => j.kind === "ai").map((j) => j.text).slice(0, 6),
    changed: journal.filter((j) => j.kind === "changed").map((j) => j.text).slice(-6),
    allowRemix: !!s.allow_remix && child.permissions.friendRemix,
    remixedFrom: p.remixedFrom ? !!p.remixedFrom : false,
  };
}

export function activeShare(token: string) {
  const s = one<ShareRow>("SELECT * FROM shares WHERE token=?", token);
  if (!s || s.status !== "active") throw notFound("This link isn't available. It may have been turned off.");
  return s;
}

shareRouter.get(
  "/share/:token",
  h((req) => {
    // Parents may preview a share that is waiting for their approval.
    const pending = one<ShareRow>("SELECT * FROM shares WHERE token=? AND status='pending'", String(req.params.token));
    if (pending && req.session?.role === "parent" && getChild(pending.child_id)?.familyId === req.session.familyId) {
      return { ...sharePayload(pending), preview: true };
    }
    const s = activeShare(String(req.params.token));
    run("UPDATE shares SET views = views + 1 WHERE token=?", s.token);
    const out = sharePayload(s);
    if (!out) throw notFound();
    return out;
  }),
);

shareRouter.get(
  "/p/:who/:slug",
  h((req) => {
    const s = one<ShareRow>("SELECT * FROM shares WHERE slug=? AND audience='public' AND status='active'", `${req.params.who}/${req.params.slug}`);
    if (!s) throw notFound("This project isn't published.");
    run("UPDATE shares SET views = views + 1 WHERE token=?", s.token);
    return sharePayload(s);
  }),
);

const lastPlayNotice = new Map<string, number>();
shareRouter.post(
  "/share/:token/played",
  h((req) => {
    const s = activeShare(String(req.params.token));
    // Owners playing their own link don't count.
    if (req.session?.childId === s.child_id) return { ok: true };
    run("UPDATE shares SET plays = plays + 1 WHERE token=?", s.token);
    const last = lastPlayNotice.get(s.token) ?? 0;
    if (Date.now() - last > 3600e3) {
      lastPlayNotice.set(s.token, Date.now());
      const p = getProject(s.project_id);
      notify(s.child_id, "🎉", `Someone tried your ${p?.type === "game" ? "game" : "creation"} “${p?.title}”!`, `/kid/project/${s.project_id}?tab=share`);
    }
    return { ok: true };
  }),
);

