import { describe, expect, it } from "vitest";
import request from "supertest";
import { openDb } from "../server/db";
import { createApp } from "../server/app";
import { setProvider } from "../server/ai/gateway";
import { OfflineProvider } from "../server/ai/offline";

openDb(":memory:");
setProvider(new OfflineProvider());
const app = createApp();
const NATIVE = { "x-sparkforge-client": "native" };

describe("native app (bearer token) auth", () => {
  it("only hands out tokens to the native client", async () => {
    const web = await request(app).post("/api/auth/register").send({ name: "Sam", email: "sam@example.com", password: "correct horse" }).expect(200);
    expect(web.body.token).toBeUndefined();
    const nat = await request(app).post("/api/auth/login").set(NATIVE).send({ email: "sam@example.com", password: "correct horse" }).expect(200);
    expect(typeof nat.body.token).toBe("string");
  });

  it("authenticates with the bearer token and enters child mode with a new one", async () => {
    const { token } = (await request(app).post("/api/auth/login").set(NATIVE).send({ email: "sam@example.com", password: "correct horse" })).body;
    const auth = { ...NATIVE, authorization: `Bearer ${token}` };
    expect((await request(app).get("/api/me").set(auth).expect(200)).body.role).toBe("parent");
    const child = await request(app).post("/api/parent/children").set(auth).send({ name: "Danai", age: 10, interests: ["Space"] }).expect(200);

    const entered = await request(app).post(`/api/parent/children/${child.body.id}/enter`).set(auth).send({}).expect(200);
    const kid = { ...NATIVE, authorization: `Bearer ${entered.body.token}` };
    expect((await request(app).get("/api/me").set(kid).expect(200)).body.role).toBe("child");
    await request(app).get("/api/parent/dashboard").set(kid).expect(401);

    await request(app).post("/api/auth/logout").set(kid).send({}).expect(200);
    expect((await request(app).get("/api/me").set(kid)).body.role).toBeNull();
  });

  it("ignores malformed or unknown tokens", async () => {
    for (const authorization of ["Bearer nope", "Bearer " + "x".repeat(40), "Basic abc"]) {
      const me = await request(app).get("/api/me").set({ ...NATIVE, authorization });
      expect(me.body.role).toBeNull();
    }
  });
});
