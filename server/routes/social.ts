// Friends, sharing with friends, reactions, building together, and the Creator Feed.
// Principles: parent-approved connections only, preset kind words instead of free chat,
// no follower counts or popularity rankings.
import { Router, type Request } from "express";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { all, newId, now, one, run, tx } from "../db";
import { requireChild, requireParent } from "../auth";
import { body, forbid, h, HttpError, notFound } from "../http";
import { getChild } from "../engines/children";
import { getProject } from "../engines/projects";
import { evaluate, notify, recordEvent } from "../engines/progress";
import { checkText, recordSafetyEvent } from "../safety";
import { activeShare, activateShare, createShare, sharesFor } from "./shares";
import { areFriends, collaboratorsOf, friendsOf, PRESET_COMMENTS, REACTIONS, tasksOf } from "../engines/social";
import type { ChildProfile, Permissions } from "../../shared/types";

export const parentSocialRouter = Router();
export const kidSocialRouter = Router();
export const publicSocialRouter = Router();
parentSocialRouter.use(requireParent);
kidSocialRouter.use(requireChild);

function familyChild(familyId: string, id: string) {
  const c = getChild(id);
  if (!c || c.familyId !== familyId) throw notFound("Child not found");
  return c;
}

// ---------- Parents connect friends ----------

const CODE_WORDS = ["STAR", "ROCKET", "COMET", "LION", "OCEAN", "ROBOT", "PIXEL", "SPARK", "PLANET", "DINO"];

parentSocialRouter.post(
  "/children/:id/friend-code",
  h((req) => {
    const c = familyChild(req.session!.familyId, String(req.params.id));
    if (!c.permissions.friends) throw forbid(`Turn on “Friends” for ${c.name} first.`);
    let code = "";
    do code = `${CODE_WORDS[randomInt(CODE_WORDS.length)]}-${randomInt(1000, 10000)}-${randomInt(10, 100)}`;
    while (one("SELECT 1 FROM friend_invites WHERE code=?", code));
    run("INSERT INTO friend_invites (code, family_id, child_id, created_at) VALUES (?,?,?,?)", code, c.familyId, c.id, now());
    return { code, expiresInDays: 7 };
  }),
);

parentSocialRouter.post(
  "/children/:id/friend-code/redeem",
  h((req) => {
    const c = familyChild(req.session!.familyId, String(req.params.id));
    const { code } = body(req, z.object({ code: z.string().trim().toUpperCase().max(40) }));
    const inv = one<{ code: string; family_id: string; child_id: string; used_by: string | null; created_at: string }>(
      "SELECT * FROM friend_invites WHERE code=?",
      code,
    );
    if (!inv || inv.used_by || Date.now() - new Date(inv.created_at).getTime() > 7 * 864e5) throw new HttpError(400, "That friend code isn't valid (codes work once, for 7 days).");
    if (inv.family_id === c.familyId) throw new HttpError(400, "That code is from your own family.");
    const other = getChild(inv.child_id);
    if (!other) throw new HttpError(400, "That friend code isn't valid.");
    if (!c.permissions.friends) throw forbid(`Turn on “Friends” for ${c.name} first.`);
    if (!other.permissions.friends) throw forbid("The other family has turned off friends for their child.");
    tx(() => {
      run("UPDATE friend_invites SET used_by=? WHERE code=?", c.id, code);
      run("INSERT OR IGNORE INTO friends (child_id, friend_id, created_at) VALUES (?,?,?)", c.id, other.id, now());
      run("INSERT OR IGNORE INTO friends (child_id, friend_id, created_at) VALUES (?,?,?)", other.id, c.id, now());
    });
    notify(c.id, "🤝", `You and ${other.name} are now SparkForge friends!`, "/kid/friends");
    notify(other.id, "🤝", `You and ${c.name} are now SparkForge friends!`, "/kid/friends");
    return { friend: { id: other.id, name: other.name, avatar: other.avatar } };
  }),
);

parentSocialRouter.get(
  "/children/:id/friends",
  h((req) => {
    const c = familyChild(req.session!.familyId, String(req.params.id));
    return friendsOf(c.id);
  }),
);

parentSocialRouter.delete(
  "/children/:id/friends/:friendId",
  h((req) => {
    const c = familyChild(req.session!.familyId, String(req.params.id));
    const f = String(req.params.friendId);
    tx(() => {
      run("DELETE FROM friends WHERE (child_id=? AND friend_id=?) OR (child_id=? AND friend_id=?)", c.id, f, f, c.id);
      // Unfriending also ends building together on each other's projects.
      run("DELETE FROM collaborators WHERE child_id=? AND project_id IN (SELECT id FROM projects WHERE child_id=?)", f, c.id);
      run("DELETE FROM collaborators WHERE child_id=? AND project_id IN (SELECT id FROM projects WHERE child_id=?)", c.id, f);
    });
    return { ok: true };
  }),
);

// ---------- Kids ----------

const me = (req: Request) => {
  const c = getChild(req.session!.childId!);
  if (!c) throw new HttpError(401, "Profile not found");
  return c;
};
function need(c: ChildProfile, key: keyof Permissions, what: string) {
  if (!c.permissions[key]) throw forbid(`${what} is turned off in your family settings. Ask a parent if you'd like to try it!`);
}

kidSocialRouter.get(
  "/friends",
  h((req) => {
    const c = me(req);
    const inbox = all<{ id: string; token: string; note: string; seen: number; created_at: string; from_name: string; from_avatar: string; title: string; emoji: string; type: string }>(
      `SELECT i.id, i.token, i.note, i.seen, i.created_at, f.name AS from_name, f.avatar AS from_avatar, p.title, p.emoji, p.type
       FROM inbox i JOIN shares s ON s.token = i.token JOIN projects p ON p.id = s.project_id JOIN children f ON f.id = i.from_child
       WHERE i.to_child=? AND s.status='active' AND p.deleted=0 ORDER BY i.created_at DESC LIMIT 40`,
      c.id,
    );
    const team = all<{ id: string; title: string; emoji: string; type: string; owner: string }>(
      `SELECT p.id, p.title, p.emoji, p.type, o.name AS owner FROM collaborators k JOIN projects p ON p.id = k.project_id
       JOIN children o ON o.id = p.child_id WHERE k.child_id=? AND p.deleted=0 ORDER BY p.updated_at DESC`,
      c.id,
    );
    return {
      enabled: c.permissions.friends,
      friends: c.permissions.friends ? friendsOf(c.id) : [],
      inbox: inbox.map((i) => ({
        id: i.id, token: i.token, note: i.note, seen: !!i.seen, createdAt: i.created_at,
        from: { name: i.from_name, avatar: i.from_avatar }, title: i.title, emoji: i.emoji, type: i.type,
      })),
      team,
      presets: PRESET_COMMENTS,
    };
  }),
);

kidSocialRouter.post(
  "/inbox/seen",
  h((req) => {
    run("UPDATE inbox SET seen=1 WHERE to_child=?", req.session!.childId!);
    return { ok: true };
  }),
);

function ownProject(req: Request) {
  const p = getProject(String(req.params.id));
  if (!p || p.childId !== req.session!.childId) throw notFound("Project not found");
  return p;
}

/** Send a creation straight to a friend's SparkForge inbox. */
kidSocialRouter.post(
  "/projects/:id/send-friend",
  h((req) => {
    const c = me(req);
    need(c, "friends", "Friends");
    need(c, "friendSharing", "Sharing with friends");
    const p = ownProject(req);
    const b = body(req, z.object({ friendId: z.string(), note: z.string().max(80).default("") }));
    if (!areFriends(c.id, b.friendId)) throw notFound("Friend not found");
    if (b.note && !PRESET_COMMENTS.includes(b.note) && b.note !== "Look what I made!") throw new HttpError(400, "Pick one of the ready-made messages.");
    let share = one<{ token: string; status: string }>("SELECT token, status FROM shares WHERE project_id=? AND audience='friends' AND status<>'revoked'", p.id);
    let rewards = null;
    if (!share) {
      const token = createShare(c.id, p.id, "friends", c.permissions.friendRemix, c.permissions.shareNeedsApproval);
      if (!c.permissions.shareNeedsApproval) rewards = activateShare(token);
      share = one<{ token: string; status: string }>("SELECT token, status FROM shares WHERE token=?", token)!;
    }
    run("INSERT INTO inbox (id, token, from_child, to_child, note, created_at) VALUES (?,?,?,?,?,?)", newId("inb"), share.token, c.id, b.friendId, b.note || "Look what I made!", now());
    const friend = getChild(b.friendId)!;
    if (share.status === "active") notify(friend.id, "📬", `${c.name} sent you “${p.title}”!`, "/kid/friends");
    return { pending: share.status !== "active", to: friend.name, shares: sharesFor(p.id), rewards };
  }),
);

/** Friends can react with emojis or preset kind comments — no free text between children. */
kidSocialRouter.post(
  "/react/:token",
  h((req) => {
    const c = me(req);
    const share = activeShare(String(req.params.token));
    const owner = getChild(share.child_id)!;
    const b = body(req, z.object({ kind: z.enum(["emoji", "comment"]), value: z.string().max(80) }));
    if (owner.id === c.id) throw new HttpError(400, "You can't react to your own creation — but we know it's great! 😄");
    if (!areFriends(c.id, owner.id)) throw forbid("Only friends can react.");
    if (b.kind === "emoji" ? !REACTIONS.includes(b.value) : !PRESET_COMMENTS.includes(b.value)) throw new HttpError(400, "Pick one of the options.");
    if (b.kind === "emoji" && !owner.permissions.reactions) throw forbid("Reactions are turned off for this creator.");
    if (b.kind === "comment" && !(owner.permissions.friendComments && c.permissions.friendComments)) throw forbid("Comments are turned off.");
    const r = run("INSERT OR IGNORE INTO reactions (project_id, child_id, kind, value, created_at) VALUES (?,?,?,?,?)", share.project_id, c.id, b.kind, b.value, now());
    if (r.changes) {
      const p = getProject(share.project_id);
      notify(owner.id, b.kind === "emoji" ? b.value : "💬", `${c.name} ${b.kind === "emoji" ? "reacted to" : "said about"} “${p?.title}”${b.kind === "comment" ? `: ${b.value}` : "!"}`, `/kid/project/${share.project_id}?tab=share`);
    }
    return { ok: true };
  }),
);

// ---------- Building together ----------

kidSocialRouter.post(
  "/projects/:id/collaborators",
  h((req) => {
    const c = me(req);
    need(c, "collaboration", "Building together");
    const p = ownProject(req);
    const b = body(req, z.object({ friendId: z.string(), role: z.string().trim().min(2).max(40) }));
    if (!areFriends(c.id, b.friendId)) throw notFound("Friend not found");
    const friend = getChild(b.friendId)!;
    if (!friend.permissions.collaboration) throw forbid(`${friend.name} can't build together right now.`);
    const role = checkText(b.role, c.age).verdict === "allow" ? b.role : "Helper";
    run("INSERT OR REPLACE INTO collaborators (project_id, child_id, role, created_at) VALUES (?,?,?,?)", p.id, friend.id, role, now());
    notify(friend.id, "🤝", `${c.name} invited you to build “${p.title}” as ${role}!`, `/kid/project/${p.id}?tab=team`);
    return { collaborators: collaboratorsOf(p.id) };
  }),
);

kidSocialRouter.delete(
  "/projects/:id/collaborators/:childId",
  h((req) => {
    const p = getProject(String(req.params.id));
    const who = String(req.params.childId);
    const self = req.session!.childId!;
    if (!p || (p.childId !== self && who !== self)) throw notFound("Project not found");
    run("DELETE FROM collaborators WHERE project_id=? AND child_id=?", p.id, who);
    return { collaborators: collaboratorsOf(p.id) };
  }),
);

function teamProject(req: Request) {
  const p = getProject(String(req.params.id));
  const self = req.session!.childId!;
  if (!p || (p.childId !== self && !one("SELECT 1 FROM collaborators WHERE project_id=? AND child_id=?", p.id, self))) throw notFound("Project not found");
  return p;
}

kidSocialRouter.post(
  "/projects/:id/tasks",
  h((req) => {
    const c = me(req);
    const p = teamProject(req);
    const b = body(req, z.object({ text: z.string().trim().min(2).max(120), assignee: z.string().max(40).nullable().default(null) }));
    const s = checkText(b.text, c.age);
    if (s.verdict !== "allow") {
      recordSafetyEvent(c.id, s, "team task", b.text);
      throw new HttpError(422, s.childMessage ?? "Let's word that differently.");
    }
    const team = new Set([p.childId, ...collaboratorsOf(p.id).map((x) => x.id), "ai"]);
    if (b.assignee && !team.has(b.assignee)) throw new HttpError(400, "Assign it to someone on the team.");
    run("INSERT INTO project_tasks (id, project_id, text, assignee, created_at) VALUES (?,?,?,?,?)", newId("tsk"), p.id, b.text, b.assignee, now());
    if (b.assignee && b.assignee !== c.id && b.assignee !== "ai") notify(b.assignee, "📝", `${c.name} gave you a task on “${p.title}”: ${b.text}`, `/kid/project/${p.id}?tab=team`);
    return { tasks: tasksOf(p.id) };
  }),
);

kidSocialRouter.patch(
  "/projects/:id/tasks/:taskId",
  h((req) => {
    const c = me(req);
    const p = teamProject(req);
    const { done } = body(req, z.object({ done: z.boolean() }));
    run("UPDATE project_tasks SET done=? WHERE id=? AND project_id=?", done ? 1 : 0, String(req.params.taskId), p.id);
    let rewards = null;
    if (done && p.childId !== c.id) {
      recordEvent(c.id, "helped", { projectId: p.id });
      rewards = evaluate(c.id, p.id);
    }
    return { tasks: tasksOf(p.id), rewards };
  }),
);

kidSocialRouter.delete(
  "/projects/:id/tasks/:taskId",
  h((req) => {
    const p = teamProject(req);
    run("DELETE FROM project_tasks WHERE id=? AND project_id=?", String(req.params.taskId), p.id);
    return { tasks: tasksOf(p.id) };
  }),
);

// ---------- Creator Feed ----------

kidSocialRouter.get(
  "/feed",
  h((req) => {
    const c = me(req);
    need(c, "seeFeed", "The Creator Feed");
    // Newest first. No likes, views or rankings — every creation gets the same spot.
    const rows = all<{ token: string; slug: string | null; child_id: string; title: string; emoji: string; type: string; description: string; created_at: string }>(
      `SELECT s.token, s.slug, s.child_id, p.title, p.emoji, p.type, p.description, s.created_at FROM shares s
       JOIN projects p ON p.id = s.project_id WHERE s.audience='public' AND s.status='active' AND p.deleted=0 AND s.child_id<>?
       ORDER BY s.created_at DESC LIMIT 30`,
      c.id,
    );
    return rows.map((r) => {
      const owner = getChild(r.child_id);
      return {
        token: r.token, slug: r.slug, title: r.title, emoji: r.emoji, type: r.type, description: r.description, createdAt: r.created_at,
        creator: owner?.permissions.showCreatorName ? owner.name : "a young creator",
      };
    });
  }),
);

// ---------- Share page extras for signed-in friends ----------

publicSocialRouter.get(
  "/share/:token/social",
  h((req) => {
    const share = activeShare(String(req.params.token));
    const owner = getChild(share.child_id)!;
    const viewer = req.session?.role === "child" ? getChild(req.session.childId!) : null;
    const friend = !!viewer && viewer.id !== owner.id && areFriends(viewer.id, owner.id);
    const reactions = all<{ kind: string; value: string }>("SELECT DISTINCT kind, value FROM reactions WHERE project_id=?", share.project_id);
    const mine = viewer ? all<{ kind: string; value: string }>("SELECT kind, value FROM reactions WHERE project_id=? AND child_id=?", share.project_id, viewer.id) : [];
    return {
      emojis: owner.permissions.reactions ? reactions.filter((r) => r.kind === "emoji").map((r) => r.value) : [],
      comments: owner.permissions.friendComments ? reactions.filter((r) => r.kind === "comment").map((r) => r.value) : [],
      canReact: friend && owner.permissions.reactions,
      canComment: friend && owner.permissions.friendComments && !!viewer?.permissions.friendComments,
      mine,
      options: { emojis: REACTIONS, comments: PRESET_COMMENTS },
    };
  }),
);
