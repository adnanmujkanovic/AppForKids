import { Router } from "express";
import { z } from "zod";
import { all, newId, now, one, run, tx } from "../db";
import {
  clearFailures,
  endSession,
  hashPassword,
  isNativeClient,
  noteFailure,
  requireParent,
  startSession,
  throttled,
  verifyPassword,
} from "../auth";
import { body, forbid, h, HttpError, notFound } from "../http";
import { defaultPermissions, MEDALS, PERMISSION_INFO, type Permissions } from "../../shared/types";
import { creatorLevel, familyChildren, getChild } from "../engines/children";
import { aiUsageToday, gatewayInfo } from "../ai/gateway";
import { activateShare } from "./shares";
import { friendsOf } from "../engines/social";

export const authRouter = Router();
export const parentRouter = Router();

authRouter.get(
  "/me",
  h((req) => {
    const s = req.session;
    const ai = gatewayInfo();
    if (!s) return { role: null, ai };
    const family = one<{ id: string; name: string }>("SELECT id, name FROM families WHERE id=?", s.familyId);
    if (s.role === "parent") {
      const p = one<{ id: string; name: string; email: string }>("SELECT id, name, email FROM parents WHERE id=?", s.parentId);
      return { role: "parent", parent: p, family, ai };
    }
    const c = getChild(s.childId!);
    return { role: "child", child: c && { id: c.id, name: c.name, avatar: c.avatar, age: c.age }, family, ai };
  }),
);

const Register = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  familyName: z.string().trim().max(60).optional(),
});

authRouter.post(
  "/auth/register",
  h((req, res) => {
    const b = body(req, Register);
    if (one("SELECT 1 FROM parents WHERE email=?", b.email)) throw new HttpError(409, "An account with that email already exists.");
    const familyId = newId("fam");
    const parentId = newId("par");
    tx(() => {
      run("INSERT INTO families (id, name, created_at) VALUES (?,?,?)", familyId, b.familyName || `${b.name}'s family`, now());
      run(
        "INSERT INTO parents (id, family_id, email, name, password_hash, created_at) VALUES (?,?,?,?,?,?)",
        parentId, familyId, b.email, b.name, hashPassword(b.password), now(),
      );
    });
    const session = startSession(res, { role: "parent", familyId, parentId, childId: null });
    return { ok: true, ...(isNativeClient(req) ? { token: session.token } : {}) };
  }),
);

authRouter.post(
  "/auth/login",
  h((req, res) => {
    const b = body(req, z.object({ email: z.string().trim().toLowerCase(), password: z.string() }));
    const key = `${b.email}|${req.ip}`;
    if (throttled(key)) throw new HttpError(429, "Too many attempts. Please wait a few minutes.");
    const p = one<{ id: string; family_id: string; password_hash: string }>("SELECT * FROM parents WHERE email=?", b.email);
    if (!p || !verifyPassword(b.password, p.password_hash)) {
      noteFailure(key);
      throw new HttpError(401, "Email or password is incorrect.");
    }
    clearFailures(key);
    if (req.session) endSession(req, res);
    const session = startSession(res, { role: "parent", familyId: p.family_id, parentId: p.id, childId: null });
    return { ok: true, ...(isNativeClient(req) ? { token: session.token } : {}) };
  }),
);

authRouter.post(
  "/auth/logout",
  h((req, res) => {
    endSession(req, res);
    return { ok: true };
  }),
);

// ---------- Parent area ----------
parentRouter.use(requireParent);

const AVATARS = ["🧒", "👧", "👦", "🧑‍🚀", "🦊", "🐱", "🐼", "🦄", "🤖", "🐉", "🦁", "🐧"];

const ChildBody = z.object({
  name: z.string().trim().min(1).max(40),
  age: z.number().int().min(4).max(18),
  avatar: z.string().max(16).optional(),
  experience: z.enum(["beginner", "some", "experienced"]).default("beginner"),
  interests: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});

parentRouter.post(
  "/children",
  h((req) => {
    const b = body(req, ChildBody);
    const id = newId("kid");
    run(
      "INSERT INTO children (id, family_id, name, age, avatar, experience, interests, help_level, permissions, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      id, req.session!.familyId, b.name, b.age, b.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)], b.experience,
      JSON.stringify(b.interests), "help", JSON.stringify(defaultPermissions(b.age)), now(),
    );
    return getChild(id);
  }),
);

function ownChild(familyId: string, id: string) {
  const c = getChild(id);
  if (!c || c.familyId !== familyId) throw notFound("Child not found");
  return c;
}

const PermissionsPatch = z
  .object(
    Object.fromEntries(
      PERMISSION_INFO.map((p) => [p.key, z.boolean().optional()]),
    ) as Record<keyof Permissions, z.ZodOptional<z.ZodBoolean>>,
  )
  .extend({
    homeworkMode: z.enum(["teach", "hints", "answers"]).optional(),
    dailyAiLimit: z.number().int().min(0).max(1000).optional(),
  });

parentRouter.patch(
  "/children/:id",
  h((req) => {
    const c = ownChild(req.session!.familyId, String(req.params.id));
    const b = body(req, ChildBody.partial().extend({ permissions: PermissionsPatch.optional() }));
    const perms = { ...c.permissions, ...(b.permissions ?? {}) };
    // Future connectors cannot be enabled until they exist.
    for (const p of PERMISSION_INFO) if (p.future) (perms as unknown as Record<string, unknown>)[p.key] = false;
    run(
      "UPDATE children SET name=?, age=?, avatar=?, experience=?, interests=?, permissions=? WHERE id=?",
      b.name ?? c.name, b.age ?? c.age, b.avatar ?? c.avatar, b.experience ?? c.experience,
      JSON.stringify(b.interests ?? c.interests), JSON.stringify(perms), c.id,
    );
    return getChild(c.id);
  }),
);

parentRouter.post(
  "/children/:id/enter",
  h((req, res) => {
    const c = ownChild(req.session!.familyId, String(req.params.id));
    const parentId = req.session!.parentId;
    endSession(req, res);
    const session = startSession(res, { role: "child", familyId: c.familyId, parentId, childId: c.id });
    return { ok: true, ...(isNativeClient(req) ? { token: session.token } : {}) };
  }),
);

parentRouter.get(
  "/dashboard",
  h((req) => {
    const familyId = req.session!.familyId;
    const kids = familyChildren(familyId);
    const since = new Date(Date.now() - 14 * 864e5).toISOString();
    const children = kids.map((c) => {
      const projects = all<{ id: string; type: string; title: string; emoji: string; version: number; updated_at: string }>(
        "SELECT id, type, title, emoji, version, updated_at FROM projects WHERE child_id=? AND deleted=0 ORDER BY updated_at DESC",
        c.id,
      );
      const topics = all<{ topic: string; n: number }>(
        "SELECT topic, COUNT(*) n FROM events WHERE child_id=? AND topic IS NOT NULL AND topic<>'' GROUP BY topic ORDER BY n DESC LIMIT 8",
        c.id,
      );
      const skills = all<{ concept: string; created_at: string }>("SELECT concept, created_at FROM skills WHERE child_id=? ORDER BY created_at DESC", c.id);
      const medals = all<{ medal_id: string; created_at: string }>("SELECT medal_id, created_at FROM medals WHERE child_id=? ORDER BY created_at DESC", c.id);
      const openAlerts = one<{ n: number }>("SELECT COUNT(*) n FROM safety_events WHERE child_id=? AND reviewed=0", c.id)!.n;
      const highAlerts = one<{ n: number }>("SELECT COUNT(*) n FROM safety_events WHERE child_id=? AND reviewed=0 AND severity='high'", c.id)!.n;
      const activity = one<{ n: number }>("SELECT COUNT(*) n FROM events WHERE child_id=? AND created_at>=?", c.id, since)!.n;
      return {
        ...c,
        level: creatorLevel(c.id),
        projectCount: projects.length,
        recentProjects: projects.slice(0, 6),
        topics: topics.map((t) => t.topic),
        newSkills: skills.slice(0, 8).map((s) => s.concept),
        medals: medals.map((m) => ({ ...MEDALS.find((x) => x.id === m.medal_id), earnedAt: m.created_at })),
        safety: highAlerts ? "attention" : openAlerts ? "review" : "ok",
        aiToday: aiUsageToday(c.id),
        friends: friendsOf(c.id),
        activity14d: activity,
      };
    });
    const ids = kids.map((k) => k.id);
    const inList = ids.map(() => "?").join(",") || "''";
    const alerts = all<{ id: string; child_id: string; severity: string; category: string; summary: string; excerpt: string; reviewed: number; created_at: string }>(
      `SELECT * FROM safety_events WHERE child_id IN (${inList}) ORDER BY reviewed, created_at DESC LIMIT 50`,
      ...ids,
    ).map((a) => ({
      id: a.id,
      childId: a.child_id,
      childName: kids.find((k) => k.id === a.child_id)?.name ?? "",
      severity: a.severity,
      category: a.category,
      summary: a.summary,
      excerpt: a.excerpt,
      reviewed: !!a.reviewed,
      createdAt: a.created_at,
    }));
    const shares = all<{ token: string; project_id: string; child_id: string; audience: string; status: string; allow_remix: number; views: number; plays: number; created_at: string; title: string; emoji: string }>(
      `SELECT s.*, p.title, p.emoji FROM shares s JOIN projects p ON p.id = s.project_id WHERE s.child_id IN (${inList}) AND s.status <> 'revoked' ORDER BY s.created_at DESC`,
      ...ids,
    ).map((s) => ({
      token: s.token,
      projectId: s.project_id,
      childName: kids.find((k) => k.id === s.child_id)?.name ?? "",
      title: s.title,
      emoji: s.emoji,
      audience: s.audience,
      status: s.status,
      allowRemix: !!s.allow_remix,
      views: s.views,
      plays: s.plays,
      createdAt: s.created_at,
    }));
    const contacts = all<{ id: string; name: string; email: string }>("SELECT id, name, email FROM contacts WHERE family_id=? ORDER BY name", familyId);
    const outbox = all<{ id: string; child_id: string; contact_id: string; subject: string; body: string; status: string; created_at: string }>(
      "SELECT * FROM outbox WHERE family_id=? ORDER BY created_at DESC LIMIT 20",
      familyId,
    ).map((o) => ({
      id: o.id,
      childName: kids.find((k) => k.id === o.child_id)?.name ?? "",
      to: contacts.find((c) => c.id === o.contact_id)?.name ?? "(removed contact)",
      subject: o.subject,
      body: o.body,
      status: o.status,
      createdAt: o.created_at,
    }));
    return { children, alerts, shares, contacts, outbox, ai: gatewayInfo() };
  }),
);

parentRouter.post(
  "/alerts/:id/review",
  h((req) => {
    const a = one<{ child_id: string }>("SELECT child_id FROM safety_events WHERE id=?", String(req.params.id));
    if (!a) throw notFound();
    ownChild(req.session!.familyId, a.child_id);
    run("UPDATE safety_events SET reviewed=1 WHERE id=?", String(req.params.id));
    return { ok: true };
  }),
);

function ownShare(familyId: string, token: string) {
  const s = one<{ token: string; child_id: string; project_id: string; status: string; audience: string }>("SELECT * FROM shares WHERE token=?", token);
  if (!s) throw notFound();
  ownChild(familyId, s.child_id);
  return s;
}

parentRouter.post(
  "/shares/:token/approve",
  h((req) => {
    const s = ownShare(req.session!.familyId, String(req.params.token));
    if (s.status !== "pending") throw forbid("This share isn't waiting for approval.");
    activateShare(s.token);
    return { ok: true };
  }),
);

parentRouter.post(
  "/shares/:token/revoke",
  h((req) => {
    const s = ownShare(req.session!.familyId, String(req.params.token));
    run("UPDATE shares SET status='revoked' WHERE token=?", s.token);
    return { ok: true };
  }),
);

parentRouter.post(
  "/contacts",
  h((req) => {
    const b = body(req, z.object({ name: z.string().trim().min(1).max(40), email: z.string().trim().email().max(200) }));
    const id = newId("con");
    run("INSERT INTO contacts (id, family_id, name, email, created_at) VALUES (?,?,?,?,?)", id, req.session!.familyId, b.name, b.email, now());
    return { id, ...b };
  }),
);

parentRouter.delete(
  "/contacts/:id",
  h((req) => {
    run("DELETE FROM contacts WHERE id=? AND family_id=?", String(req.params.id), req.session!.familyId);
    return { ok: true };
  }),
);

parentRouter.get(
  "/children/:id/projects/:pid",
  h((req) => {
    const c = ownChild(req.session!.familyId, String(req.params.id));
    const p = one<{ id: string; child_id: string; type: string; title: string; spec: string; version: number }>(
      "SELECT id, child_id, type, title, spec, version FROM projects WHERE id=? AND deleted=0",
      String(req.params.pid),
    );
    if (!p || p.child_id !== c.id) throw notFound();
    return { ...p, spec: JSON.parse(p.spec) };
  }),
);
