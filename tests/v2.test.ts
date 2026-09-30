import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
process.env.SPARKFORGE_SECRET = "test-secret";
import { openDb } from "../server/db";
import { createApp } from "../server/app";
import { setProvider } from "../server/ai/gateway";
import { OfflineProvider } from "../server/ai/offline";
import { setGithubFetch } from "../server/connectors/github";

openDb(":memory:");
setProvider(new OfflineProvider());
const app = createApp();

async function family(email: string, kidName: string, age = 11) {
  const parent = request.agent(app);
  await parent.post("/api/auth/register").send({ name: `${kidName}'s parent`, email, password: "long password" }).expect(200);
  const c = await parent.post("/api/parent/children").send({ name: kidName, age }).expect(200);
  const kid = request.agent(app);
  await kid.post("/api/auth/login").send({ email, password: "long password" }).expect(200);
  await kid.post(`/api/parent/children/${c.body.id}/enter`).send({}).expect(200);
  return { parent, kid, id: c.body.id as string };
}
const medals = async (kid: request.Agent) => (await kid.get("/api/kid/passport")).body.medals.map((m: { medal_id: string }) => m.medal_id);

let danai: Awaited<ReturnType<typeof family>>;
let leo: Awaited<ReturnType<typeof family>>;
let gameId = "";

beforeAll(async () => {
  danai = await family("danai@example.com", "Danai");
  leo = await family("leo@example.com", "Leo");
  gameId = (await danai.kid.post("/api/kid/games").send({ idea: "Mars rover", kind: "catcher" }).expect(200)).body.project.id;
});

describe("Code Mode", () => {
  let codeId = "";
  it("turns a game into real JavaScript", async () => {
    const r = await danai.kid.post(`/api/kid/projects/${gameId}/eject`).send({}).expect(200);
    codeId = r.body.project.id;
    expect(r.body.project.type).toBe("code");
    expect(r.body.project.spec.source).toContain("game.onCollect(");
    expect(r.body.project.spec.source).toContain("createGame(");
  });

  it("saves code without flagging numbers as phone numbers, but checks strings", async () => {
    const d = (await danai.kid.get(`/api/kid/projects/${codeId}`).expect(200)).body.project.spec;
    const source = d.source.replace("game.score + thing.points", "game.score + thing.points * 1000000");
    await danai.kid.put(`/api/kid/projects/${codeId}/spec`).send({ spec: { ...d, source } }).expect(200);
    await danai.kid.put(`/api/kid/projects/${codeId}/spec`).send({ spec: { ...d, source: `${source}\ngame.say("call me 555 123 4567");` } }).expect(422);
  });

  it("awards Real Coder after changing code and running it", async () => {
    await danai.kid.post(`/api/kid/projects/${codeId}/ran`).send({ ok: true }).expect(200);
    expect(await medals(danai.kid)).toContain("real-coder");
  });

  it("exports a standalone, locked-down web page", async () => {
    const r = await danai.kid.get(`/api/kid/projects/${codeId}/export`).expect(200);
    expect(r.headers["content-disposition"]).toMatch(/attachment/);
    expect(r.text).toContain("Content-Security-Policy");
    expect(r.text).toContain("connect-src 'none'");
    expect(r.text).toContain("window.createGame");
    expect(r.text).toContain("Made by Danai");
  });

  it("offline AI can make simple code changes", async () => {
    const r = await danai.kid.post(`/api/kid/projects/${codeId}/ai-change`).send({ request: "give an extra life every level" }).expect(200);
    expect(r.body.understood).toBe(true);
    expect(r.body.project.spec.source).toContain("game.lives = game.lives + 1");
  });

  it("starts a code project from scratch", async () => {
    const r = await danai.kid.post("/api/kid/code").send({ title: "Star Coder" }).expect(200);
    expect(r.body.project.spec.source).toContain("let streak = 0;");
  });
});

describe("Friends and building together", () => {
  it("connects friends only through both parents", async () => {
    await leo.kid.post(`/api/parent/children/${leo.id}/friend-code`).send({}).expect(401); // kids can't
    const code = (await leo.parent.post(`/api/parent/children/${leo.id}/friend-code`).send({}).expect(200)).body.code;
    await leo.parent.post(`/api/parent/children/${leo.id}/friend-code/redeem`).send({ code }).expect(400); // own family
    const r = await danai.parent.post(`/api/parent/children/${danai.id}/friend-code/redeem`).send({ code }).expect(200);
    expect(r.body.friend.name).toBe("Leo");
    await danai.parent.post(`/api/parent/children/${danai.id}/friend-code/redeem`).send({ code }).expect(400); // one use
    const f = (await leo.kid.get("/api/kid/friends").expect(200)).body;
    expect(f.friends.map((x: { name: string }) => x.name)).toEqual(["Danai"]);
  });

  it("sends a creation to a friend's inbox", async () => {
    await danai.kid.post(`/api/kid/projects/${gameId}/send-friend`).send({ friendId: leo.id, note: "Look what I made!" }).expect(200);
    const inbox = (await leo.kid.get("/api/kid/friends").expect(200)).body.inbox;
    expect(inbox[0].title).toBeTruthy();
    expect(inbox[0].from.name).toBe("Danai");
    const token = inbox[0].token;
    // Friends react with emojis and preset comments only.
    await leo.kid.post(`/api/kid/react/${token}`).send({ kind: "emoji", value: "🤩" }).expect(200);
    await leo.kid.post(`/api/kid/react/${token}`).send({ kind: "comment", value: "you are dumb" }).expect(400);
    await leo.kid.post(`/api/kid/react/${token}`).send({ kind: "comment", value: "How did you make it?" }).expect(200);
    const social = (await request(app).get(`/api/share/${token}/social`).expect(200)).body;
    expect(social.emojis).toContain("🤩");
    expect(social.canReact).toBe(false); // anonymous viewers can't react
    const home = (await danai.kid.get("/api/kid/home")).body;
    expect(home.notifications.some((n: { text: string }) => n.text.includes("How did you make it?"))).toBe(true);
  });

  it("lets an invited friend build, credits them, and awards Community Helper", async () => {
    await leo.kid.get(`/api/kid/projects/${gameId}`).expect(404);
    await danai.kid.post(`/api/kid/projects/${gameId}/collaborators`).send({ friendId: leo.id, role: "Level Designer" }).expect(200);
    const d = (await leo.kid.get(`/api/kid/projects/${gameId}`).expect(200)).body;
    expect(d.role).toBe("collaborator");
    const r = await leo.kid.post(`/api/kid/projects/${gameId}/ai-change`).send({ request: "add 1 level" }).expect(200);
    expect(r.body.understood).toBe(true);
    const versions = (await danai.kid.get(`/api/kid/projects/${gameId}`)).body.versions;
    expect(versions[0].byName).toBe("Leo");
    expect(await medals(leo.kid)).toContain("community-helper");
    await leo.kid.delete(`/api/kid/projects/${gameId}`).expect(404); // only the owner can delete
    await leo.kid.post(`/api/kid/projects/${gameId}/share`).send({ audience: "family" }).expect(404);
  });

  it("keeps a team task list", async () => {
    const t = await danai.kid.post(`/api/kid/projects/${gameId}/tasks`).send({ text: "Draw the aliens", assignee: leo.id }).expect(200);
    const task = t.body.tasks[0];
    const done = await leo.kid.patch(`/api/kid/projects/${gameId}/tasks/${task.id}`).send({ done: true }).expect(200);
    expect(done.body.tasks[0].done).toBe(true);
  });

  it("unfriending ends collaboration", async () => {
    await danai.parent.delete(`/api/parent/children/${danai.id}/friends/${leo.id}`).expect(200);
    await leo.kid.get(`/api/kid/projects/${gameId}`).expect(404);
  });

  it("the Creator Feed is off by default and shows public projects when on", async () => {
    await leo.kid.get("/api/kid/feed").expect(403);
    await leo.parent.patch(`/api/parent/children/${leo.id}`).send({ permissions: { seeFeed: true } }).expect(200);
    await danai.parent.patch(`/api/parent/children/${danai.id}`).send({ permissions: { publicPublishing: true } }).expect(200);
    await danai.kid.post(`/api/kid/projects/${gameId}/share`).send({ audience: "public" }).expect(200);
    const feed = (await leo.kid.get("/api/kid/feed").expect(200)).body;
    expect(feed[0].creator).toBe("Danai");
    expect(feed[0]).not.toHaveProperty("views");
  });
});

describe("Agents, planner, connectors", () => {
  it("plans a multi-step change for approval", async () => {
    const r = await danai.kid.post(`/api/kid/projects/${gameId}/agent/plan`).send({ goal: "make it harder" }).expect(200);
    expect(r.body.plan.steps.length).toBeGreaterThanOrEqual(2);
    // Each step is then applied (and saved as a version) through the normal AI change.
    const step = r.body.plan.steps[0];
    const s = await danai.kid.post(`/api/kid/projects/${gameId}/ai-change`).send({ request: step.request }).expect(200);
    expect(s.body.understood).toBe(true);
  });

  it("makes a checklist plan the child can edit", async () => {
    const r = await danai.kid.post("/api/kid/plans").send({ goal: "Get ready for my science test" }).expect(200);
    expect(r.body.plan.steps.length).toBeGreaterThan(2);
    const steps = r.body.plan.steps.map((s: object, i: number) => ({ ...s, done: i === 0 }));
    await danai.kid.put(`/api/kid/plans/${r.body.plan.id}`).send({ title: "Science test", steps }).expect(200);
    const list = (await danai.kid.get("/api/kid/plans")).body;
    expect(list[0].steps[0].done).toBe(true);
  });

  it("connects GitHub (token encrypted) and deploys a project", async () => {
    const calls: { method: string; url: string; body?: string }[] = [];
    setGithubFetch(async (url, init) => {
      const u = String(url);
      calls.push({ method: init?.method ?? "GET", url: u, body: init?.body as string | undefined });
      const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
      if (u.endsWith("/user")) return json(200, { login: "SamCodes" });
      if (init?.method === "GET" && u.includes("/contents/")) return json(404, { message: "Not Found" });
      return json(201, {});
    });
    await danai.parent.post("/api/parent/connectors/github").send({ token: "github_pat_1234567890abcdefghij" }).expect(200);
    await danai.parent.patch(`/api/parent/children/${danai.id}`).send({ permissions: { github: true } }).expect(200);
    const r = await danai.kid.post(`/api/kid/projects/${gameId}/deploy`).send({}).expect(200);
    expect(r.body.pagesUrl).toMatch(/^https:\/\/samcodes\.github\.io\/sparkforge-/);
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/user/repos"))).toBe(true);
    expect(calls.some((c) => c.method === "PUT" && c.url.endsWith("/contents/index.html"))).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/pages"))).toBe(true);
    expect(await medals(danai.kid)).toContain("shipped");
    const conn = (await danai.parent.get("/api/parent/connectors")).body;
    expect(conn.github.account).toBe("SamCodes");
    expect(JSON.stringify(conn)).not.toContain("github_pat");
  });

  it("keeps email in the outbox when SMTP isn't configured", async () => {
    await danai.parent.post("/api/parent/contacts").send({ name: "Grandma", email: "grandma@example.com" }).expect(200);
    await danai.parent.patch(`/api/parent/children/${danai.id}`).send({ permissions: { emailSharing: true } }).expect(200);
    const contacts = (await danai.kid.get("/api/kid/contacts")).body;
    const token = (await danai.kid.get(`/api/kid/projects/${gameId}`)).body.shares[0].token;
    const r = await danai.kid.post(`/api/kid/projects/${gameId}/email`).send({ contactId: contacts[0].id, token }).expect(200);
    expect(r.body.status).toBe("kept");
    const dash = (await danai.parent.get("/api/parent/dashboard")).body;
    expect(dash.outbox[0].status).toBe("kept");
    expect(dash.outbox[0].body).toMatch(/http:\/\/127\.0\.0\.1:\d+\/s\//);
  });
});
