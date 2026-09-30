// Claude provider. Every call asks for structured output validated against a Zod schema,
// so the rest of the app only ever sees well-formed data.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import {
  AppPlanSchema,
  AppResultSchema,
  ChatReplySchema,
  DetectiveSchema,
  GameResultSchema,
  ModerationSchema,
  ModifyResultSchema,
  UnderstandingSchema,
  type AIProvider,
  type AppPlan,
  type ChatRequest,
  type ChildContext,
  type Modification,
} from "./types";
import {
  APP_PLAN_TASK,
  APP_TASK,
  CHAT_FORMAT,
  DETECTIVE_TASK,
  GAME_TASK,
  GLOBAL_SAFETY,
  MODIFY_APP_TASK,
  MODIFY_GAME_TASK,
  SCENE_TASK,
  STORY_TASK,
  systemPrompt,
} from "./prompts";
import { GameSpecInput, normalizeGame, type GameKind, type GameSpec } from "../../shared/game";
import { AppSpecInput, normalizeApp, type AppSpec } from "../../shared/app";
import { normalizeScene, normalizeStory, SceneSpec, StorySpec } from "../../shared/creations";

type Effort = "low" | "medium" | "high";

export class RefusalError extends Error {}

export interface Usage {
  input: number;
  output: number;
}

export class ClaudeProvider implements AIProvider {
  readonly name = "claude";
  private client: Anthropic;
  lastUsage: Usage = { input: 0, output: 0 };

  constructor(
    private model = process.env.SPARKFORGE_MODEL ?? "claude-opus-5-5",
    client?: Anthropic,
  ) {
    this.client = client ?? new Anthropic();
  }

  private async structured<S extends z.ZodType>(
    system: string,
    messages: BetaMessageParam[],
    schema: S,
    effort: Effort,
    maxTokens = 16000,
  ): Promise<z.infer<S>> {
    const res = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages,
      output_config: { effort, format: betaZodOutputFormat(schema) },
      // Server-side fallback: if a safeguard declines, the API retries on a suitable model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    this.lastUsage = { input: res.usage.input_tokens, output: res.usage.output_tokens };
    if (res.stop_reason === "refusal") throw new RefusalError(res.stop_details?.explanation ?? "refused");
    if (res.stop_reason === "max_tokens") throw new Error("Response was cut off (max_tokens)");
    if (res.parsed_output == null) throw new Error("Model returned no structured output");
    return res.parsed_output as z.infer<S>;
  }

  private sys(ctx: ChildContext, task: string, mode: Parameters<typeof systemPrompt>[1] = "builder", project?: string) {
    return `${systemPrompt(ctx, mode, project)}\n\nTask:\n${task}`;
  }

  async chat(req: ChatRequest) {
    const history: BetaMessageParam[] = req.history.slice(-12).map((t) => ({ role: t.role, content: t.content }));
    const content: BetaMessageParam["content"] = req.image
      ? [
          { type: "image", source: { type: "base64", media_type: req.image.mediaType, data: req.image.data } },
          { type: "text", text: req.message || "Can you help me with this?" },
        ]
      : req.message;
    // The API needs alternating roles starting with user; drop a leading assistant turn if present.
    while (history.length && history[0].role !== "user") history.shift();
    return this.structured(
      `${systemPrompt(req.ctx, req.mode, req.projectContext, req.persona)}\n\n${CHAT_FORMAT}`,
      [...history, { role: "user", content }],
      ChatReplySchema,
      "low",
      4000,
    );
  }

  async scene(ctx: ChildContext, prompt: string) {
    const out = await this.structured(
      this.sys(ctx, `${SCENE_TASK}\nThe child's avatar emoji is ${ctx.avatar}.`, "explorer"),
      [{ role: "user", content: prompt }],
      SceneSpec,
      "low",
      4000,
    );
    return normalizeScene(out);
  }

  async story(ctx: ChildContext, prompt: string) {
    return normalizeStory(
      await this.structured(this.sys(ctx, STORY_TASK, "explorer"), [{ role: "user", content: prompt }], StorySpec, "low", 6000),
    );
  }

  async game(ctx: ChildContext, req: { idea: string; kind: GameKind; topicNotes: string }) {
    const out = await this.structured(
      this.sys(ctx, GAME_TASK),
      [
        {
          role: "user",
          content: `Game idea: ${req.idea}\nGame type: ${req.kind}\n${req.topicNotes ? `What we just talked about: ${req.topicNotes}` : ""}`,
        },
      ],
      GameResultSchema,
      "medium",
    );
    return { spec: normalizeGame(out.spec), summary: out.summary, aiHelped: out.aiHelped.slice(0, 5) };
  }

  async modifyGame(ctx: ChildContext, spec: GameSpec, request: string): Promise<Modification<GameSpec>> {
    const Schema = ModifyResultSchema.extend({ spec: GameSpecInput });
    const out = await this.structured(
      this.sys(ctx, MODIFY_GAME_TASK),
      [{ role: "user", content: `Current game:\n${JSON.stringify(spec)}\n\nChange request from the child: ${request}` }],
      Schema,
      "medium",
    );
    return { ...out, spec: out.understood ? normalizeGame(out.spec) : spec };
  }

  async appPlan(ctx: ChildContext, idea: string): Promise<AppPlan> {
    return this.structured(this.sys(ctx, APP_PLAN_TASK), [{ role: "user", content: idea }], AppPlanSchema, "low", 4000);
  }

  async app(ctx: ChildContext, req: { idea: string; plan: AppPlan; allowAiGuide: boolean }) {
    const out = await this.structured(
      this.sys(ctx, `${APP_TASK}\n${req.allowAiGuide ? "" : "Do NOT use aiGuide blocks (disabled by the parent)."}`),
      [{ role: "user", content: `App idea: ${req.idea}\nApproved plan:\n${JSON.stringify(req.plan)}` }],
      AppResultSchema,
      "medium",
    );
    const spec = normalizeApp(out.spec);
    if (!req.allowAiGuide) for (const s of spec.screens) s.blocks = s.blocks.filter((b) => b.type !== "aiGuide");
    return { spec, summary: out.summary, aiHelped: out.aiHelped.slice(0, 5) };
  }

  async modifyApp(ctx: ChildContext, spec: AppSpec, request: string, allowAiGuide: boolean): Promise<Modification<AppSpec>> {
    const Schema = ModifyResultSchema.extend({ spec: AppSpecInput });
    const out = await this.structured(
      this.sys(ctx, `${MODIFY_APP_TASK}\n${allowAiGuide ? "" : "aiGuide blocks are disabled by the parent: never add them."}`),
      [{ role: "user", content: `Current app:\n${JSON.stringify(spec)}\n\nChange request from the child: ${request}` }],
      Schema,
      "medium",
    );
    const next = out.understood ? normalizeApp(out.spec) : spec;
    if (!allowAiGuide) for (const s of next.screens) s.blocks = s.blocks.filter((b) => b.type !== "aiGuide");
    return { ...out, spec: next };
  }

  async detective(ctx: ChildContext, topic: string) {
    const out = await this.structured(
      this.sys(ctx, DETECTIVE_TASK, "explorer"),
      [{ role: "user", content: `Topic: ${topic || "anything the child is interested in"}` }],
      DetectiveSchema,
      "medium",
      4000,
    );
    return { ...out, statements: out.statements.slice(0, 3), wrong: Math.min(2, Math.max(0, Math.round(out.wrong))) };
  }

  async checkUnderstanding(ctx: ChildContext, project: string, explanation: string) {
    return this.structured(
      this.sys(
        ctx,
        "The child explained how their project works in their own words. Decide if it shows real understanding of at least one mechanism (not just describing what it looks like). Be generous for their age. feedback: 1–2 encouraging sentences, with one specific thing to add if not understood.",
        "reviewer",
        project,
      ),
      [{ role: "user", content: explanation }],
      UnderstandingSchema,
      "low",
      2000,
    );
  }

  async moderate(text: string) {
    return this.structured(
      `${GLOBAL_SAFETY}\n\nTask: You moderate text a child wants to show publicly (a title or description). safe=false if it contains personal information (full names, addresses, schools, contact details), unkind or inappropriate content. reason: short, kid-friendly.`,
      [{ role: "user", content: `<text>${text}</text>` }],
      ModerationSchema,
      "low",
      1000,
    );
  }
}
