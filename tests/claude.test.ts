import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { openDb } from "../server/db";
import { ClaudeProvider } from "../server/ai/anthropic";
import { callAI, setProvider } from "../server/ai/gateway";
import type { ChildContext } from "../server/ai/types";

openDb(":memory:");
const ctx: ChildContext = {
  age: 8, experience: "beginner", creatorLevel: "explorer", interests: ["space"], helpLevel: "teach",
  knownConcepts: ["Variables"], homeworkMode: "teach", avatar: "🧒",
};

function fakeClient(reply: Record<string, unknown>) {
  const calls: Record<string, unknown>[] = [];
  const client = { beta: { messages: { parse: async (params: Record<string, unknown>) => { calls.push(params); return reply; } } } };
  return { client: client as unknown as Anthropic, calls };
}

describe("Claude provider", () => {
  it("sends layered prompts, effort and server-side fallback, and returns parsed output", async () => {
    const parsed = { reply: "Rust!", topic: "Mars", certainty: "sure", checkTip: "", followUp: "Why?", suggestions: ["game"], sources: [] };
    const { client, calls } = fakeClient({ stop_reason: "end_turn", parsed_output: parsed, usage: { input_tokens: 10, output_tokens: 5 } });
    const p = new ClaudeProvider("claude-opus-5-5", client);
    const out = await p.chat({ ctx, mode: "explorer", history: [{ role: "assistant", content: "hi" }], message: "Why is Mars red?" });
    expect(out.reply).toBe("Rust!");
    const req = calls[0] as { model: string; fallbacks: string; betas: string[]; system: string; messages: { role: string }[]; output_config: { effort: string } };
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.fallbacks).toBe("default");
    expect(req.betas).toContain("server-side-fallback-2026-07-01");
    expect(req.output_config.effort).toBe("low");
    expect(req.system).toMatch(/Safety rules/);
    expect(req.system).toMatch(/Age 8/);
    expect(req.system).toMatch(/Teach me/);
    expect(req.system).not.toMatch(/Danai/); // no names reach the model
    expect(req.messages[0].role).toBe("user"); // leading assistant turn dropped
  });

  it("falls back to the offline helper when the model refuses", async () => {
    const { client } = fakeClient({ stop_reason: "refusal", stop_details: { explanation: "no" }, parsed_output: null, usage: { input_tokens: 1, output_tokens: 0 } });
    setProvider(new ClaudeProvider("claude-opus-5-5", client));
    const r = await callAI("chat", null, ctx, null, (ai) => ai.chat({ ctx, mode: "explorer", history: [], message: "Why is Mars red?" }));
    expect(r.provider).toBe("offline");
    expect(r.note).toMatch(/couldn't help/);
    expect(r.data.reply).toMatch(/rust/i);
  });

  it("normalizes model-generated games", async () => {
    const spec = {
      title: "Space", kind: "catcher", goal: "Go", theme: { sky: "nope", ground: "#000000", decorations: [] },
      player: { emoji: "🚀", name: "R", speed: 50 }, collectibles: [{ emoji: "⭐", name: "Star", points: 1, fact: "" }],
      hazards: [], rules: { lives: 3, timeLimit: 0 }, levels: [{ name: "L1", targetScore: 5, spawnRate: 3, hazardSpeed: 3 }], quiz: [],
    };
    const { client } = fakeClient({ stop_reason: "end_turn", parsed_output: { spec, summary: "s", aiHelped: ["x"] }, usage: { input_tokens: 1, output_tokens: 1 } });
    const g = await new ClaudeProvider("claude-opus-5-5", client).game(ctx, { idea: "space", kind: "catcher", topicNotes: "" });
    expect(g.spec.player.speed).toBe(10);
    expect(g.spec.theme.sky).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("adds kid-safe web search only when the parent allows it, and filters sources", async () => {
    const parsed = { reply: "Yes", topic: "Mars", certainty: "sure", checkTip: "", followUp: "", suggestions: [], sources: ["https://mars.nasa.gov/x", "https://evil.example.com/y"] };
    const { client, calls } = fakeClient({ stop_reason: "end_turn", parsed_output: parsed, usage: { input_tokens: 1, output_tokens: 1 } });
    const p = new ClaudeProvider("claude-opus-5-5", client);
    const off = await p.chat({ ctx, mode: "explorer", history: [], message: "Is there water on Mars?" });
    expect((calls[0] as { tools?: unknown }).tools).toBeUndefined();
    expect(off.sources).toEqual([]);
    const on = await p.chat({ ctx, mode: "explorer", history: [], message: "Is there water on Mars?", webAccess: true });
    const tools = (calls[1] as { tools: { type: string; allowed_domains: string[] }[] }).tools;
    expect(tools[0].type).toBe("web_search_20260209");
    expect(tools[0].allowed_domains).toContain("nasa.gov");
    expect(on.sources).toEqual(["https://mars.nasa.gov/x"]);
  });
});
