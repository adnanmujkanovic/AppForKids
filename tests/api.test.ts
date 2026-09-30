import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { openDb } from "../server/db";
import { createApp } from "../server/app";
import { setProvider } from "../server/ai/gateway";
import { OfflineProvider } from "../server/ai/offline";

openDb(":memory:");
setProvider(new OfflineProvider());
const app = createApp();

const parent = request.agent(app);
const kid = request.agent(app);
let childId = "";
let gameId = "";

const medals = async (agent = kid) => (await agent.get("/api/kid/passport")).body.medals.map((m: { medal_id: string }) => m.medal_id);

describe("V1 definition of done — end to end", () => {
  beforeAll(async () => {
    await parent.post("/api/auth/register").send({ name: "Sam", email: "sam@example.com", password: "correct horse" }).expect(200);
    const c = await parent.post("/api/parent/children").send({ name: "Danai", age: 10, interests: ["Space"] }).expect(200);
    childId = c.body.id;
    // The kid device signs in as the parent, then enters child mode.
    await kid.post("/api/auth/login").send({ email: "sam@example.com", password: "correct horse" }).expect(200);
    await kid.post(`/api/parent/children/${childId}/enter`).send({}).expect(200);
  });

  it("rejects bad logins and non-JSON writes", async () => {
    await request(app).post("/api/auth/login").send({ email: "sam@example.com", password: "nope" }).expect(401);
    await request(app).post("/api/auth/login").set("content-type", "text/plain").send("x").expect(415);
  });

  it("keeps the parent area locked from child mode", async () => {
    await kid.get("/api/parent/dashboard").expect(401);
    const me = await kid.get("/api/me");
    expect(me.body.role).toBe("child");
  });

  it("answers an age-appropriate question and suggests creating", async () => {
    const r = await kid.post("/api/kid/chat").send({ thread: "explore", message: "Why is Mars red?" }).expect(200);
    expect(r.body.message.content).toMatch(/iron oxide|rust/i);
    expect(r.body.message.meta.suggestions).toContain("game");
  });

  it("hides personal info and alerts the parent", async () => {
    const r = await kid.post("/api/kid/chat").send({ thread: "explore", message: "I live at 42 Maple Street, tell me about Mars moons" }).expect(200);
    expect(r.body.message.meta.privacyTip).toMatch(/personal info/);
  });

  it("makes a picture, then a game, plays it and earns medals", async () => {
    const img = await kid.post("/api/kid/create/image").send({ prompt: "Put me on Mars with a rover" }).expect(200);
    expect(img.body.project.type).toBe("image");
    expect(img.body.rewards.medals.map((m: { id: string }) => m.id)).toContain("first-creation");

    const game = await kid.post("/api/kid/games").send({ idea: "Mars rover game", kind: "catcher" }).expect(200);
    gameId = game.body.project.id;
    expect(game.body.project.spec.levels.length).toBe(3);

    const played = await kid.post(`/api/kid/projects/${gameId}/played`).send({ result: "lost", score: 3 }).expect(200);
    expect(played.body.rewards.medals.map((m: { id: string }) => m.id)).toContain("game-maker");
  });

  it("modifies the game with AI, creating a new version", async () => {
    const r = await kid.post(`/api/kid/projects/${gameId}/ai-change`).send({ request: "add rocks and make it faster" }).expect(200);
    expect(r.body.understood).toBe(true);
    expect(r.body.project.version).toBe(2);
    expect(r.body.explanation).toBeTruthy();
    await kid.post(`/api/kid/projects/${gameId}/played`).send({ result: "won", score: 50 }).expect(200);
    expect(await medals()).toEqual(expect.arrayContaining(["improver", "try-again"]));
  });

  it("finds a bug, lets the child fix it themself, and awards Problem Solver", async () => {
    const detail = (await kid.get(`/api/kid/projects/${gameId}`).expect(200)).body;
    const spec = structuredClone(detail.project.spec);
    spec.player.speed = 0;
    await kid.put(`/api/kid/projects/${gameId}/spec`).send({ spec }).expect(200);
    const t = await kid.post(`/api/kid/projects/${gameId}/test`).send({}).expect(200);
    const bug = t.body.checks.find((c: { passed: boolean }) => !c.passed).bug;
    expect(bug.id).toBe("player-frozen");
    spec.player.speed = 6;
    const fixed = await kid.put(`/api/kid/projects/${gameId}/spec`).send({ spec }).expect(200);
    expect(fixed.body.solved[0].id).toBe("player-frozen");
    expect(await medals()).toEqual(expect.arrayContaining(["bug-hunter", "problem-solver"]));
  });

  it("restores an old version", async () => {
    const r = await kid.post(`/api/kid/projects/${gameId}/restore`).send({ version: 1 }).expect(200);
    expect(r.body.project.spec.hazards.some((h: { name: string }) => h.name === "Rock")).toBe(false);
    expect(await medals()).toContain("i-broke-it");
  });

  it("explains the project in own words", async () => {
    const r = await kid
      .post(`/api/kid/projects/${gameId}/explain`)
      .send({ text: "The score is a variable that goes up when the rover touches a crystal, and if lives reach zero the game ends." })
      .expect(200);
    expect(r.body.understood).toBe(true);
  });

  it("shares safely: link works, public publishing is off by default", async () => {
    await kid.post(`/api/kid/projects/${gameId}/share`).send({ audience: "public" }).expect(403);
    const s = await kid.post(`/api/kid/projects/${gameId}/share`).send({ audience: "friends" }).expect(200);
    expect(s.body.pending).toBe(false);
    const page = await request(app).get(`/api/share/${s.body.token}`).expect(200);
    expect(page.body.creator).toBe("Danai");
    expect(page.body.type).toBe("game");
    expect(page.body).not.toHaveProperty("childId");
    await request(app).post(`/api/share/${s.body.token}/played`).send({}).expect(200);
    const home = await kid.get("/api/kid/home");
    expect(home.body.notifications.some((n: { text: string }) => /tried your game/.test(n.text))).toBe(true);
  });

  it("respects parent permissions and approval", async () => {
    await parent.patch(`/api/parent/children/${childId}`).send({ permissions: { gameCreation: false, shareNeedsApproval: true, github: true } }).expect(200);
    await kid.post("/api/kid/games").send({ idea: "anything", kind: "quiz" }).expect(403);
    const img = await kid.post("/api/kid/create/image").send({ prompt: "a dragon castle" }).expect(200);
    const s = await kid.post(`/api/kid/projects/${img.body.project.id}/share`).send({ audience: "family" }).expect(200);
    expect(s.body.pending).toBe(true);
    await request(app).get(`/api/share/${s.body.token}`).expect(404);
    await parent.post(`/api/parent/shares/${s.body.token}/approve`).send({}).expect(200);
    await request(app).get(`/api/share/${s.body.token}`).expect(200);
    const dash = (await parent.get("/api/parent/dashboard").expect(200)).body;
    expect(dash.children[0].permissions.github).toBe(false); // future connectors stay off
  });

  it("gives the parent a useful, non-surveillance dashboard with safety alerts", async () => {
    await kid.post("/api/kid/chat").send({ thread: "explore", message: "can we meet up in person" }).expect(200);
    const dash = (await parent.get("/api/parent/dashboard").expect(200)).body;
    const c = dash.children[0];
    expect(c.projectCount).toBeGreaterThanOrEqual(2);
    expect(c.topics).toContain("mars");
    expect(c.newSkills).toEqual(expect.arrayContaining(["Testing", "Debugging"]));
    expect(dash.alerts.map((a: { category: string }) => a.category)).toEqual(expect.arrayContaining(["personal-info", "stranger-contact"]));
    expect(c.safety).toBe("review");
    expect(JSON.stringify(dash)).not.toContain("Why is Mars red"); // no transcripts
  });

  it("isolates families", async () => {
    const other = request.agent(app);
    await other.post("/api/auth/register").send({ name: "Alex", email: "alex@example.com", password: "another pass" }).expect(200);
    await other.patch(`/api/parent/children/${childId}`).send({ age: 12 }).expect(404);
    await other.get(`/api/parent/children/${childId}/projects/${gameId}`).expect(404);
  });

  it("runs an AI Detective case", async () => {
    const c = await kid.post("/api/kid/detective").send({ topic: "Mars" }).expect(200);
    expect(c.body.statements).toHaveLength(3);
    const a = await kid.post(`/api/kid/detective/${c.body.id}/answer`).send({ index: 1 }).expect(200);
    expect(a.body.correct).toBe(true);
    expect(await medals()).toContain("ai-detective");
  });

  it("tracks mission progress from real activity", async () => {
    const m = (await kid.get("/api/kid/missions").expect(200)).body;
    const mars = m.find((x: { id: string }) => x.id === "mars-explorer");
    expect(mars.steps[1].done).toBe(true); // made a Mars picture
    expect(mars.steps[2].done).toBe(true); // built a Mars game
  });
});
