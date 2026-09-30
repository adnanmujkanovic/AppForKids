// Contracts for the AI Gateway. Providers implement AIProvider; nothing else talks to a model.
import { z } from "zod";
import type { GameKind, GameSpec } from "../../shared/game";
import { GameSpecInput } from "../../shared/game";
import type { AppSpec } from "../../shared/app";
import { AppSpecInput } from "../../shared/app";
import type { SceneSpec, StorySpec } from "../../shared/creations";
import type { CreatorLevelId, Experience, HelpLevel, HomeworkMode } from "../../shared/types";

/** Everything a model may know about the child. Deliberately excludes name, email and family. */
export interface ChildContext {
  age: number;
  experience: Experience;
  creatorLevel: CreatorLevelId;
  interests: string[];
  helpLevel: HelpLevel;
  knownConcepts: string[];
  homeworkMode: HomeworkMode;
  avatar: string;
}

export type ChatMode = "explorer" | "tutor" | "builder" | "reviewer" | "mission" | "appGuide";

export const SUGGESTIONS = ["learn_more", "picture", "quiz", "game", "app", "story", "mission"] as const;
export type Suggestion = (typeof SUGGESTIONS)[number];

export const ChatReplySchema = z.object({
  reply: z.string(),
  topic: z.string(),
  certainty: z.enum(["sure", "mostly", "unsure"]),
  checkTip: z.string(),
  followUp: z.string(),
  suggestions: z.array(z.enum(SUGGESTIONS)),
  sources: z.array(z.string()),
});
export type ChatReply = z.infer<typeof ChatReplySchema>;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  ctx: ChildContext;
  mode: ChatMode;
  history: ChatTurn[];
  message: string;
  image?: { mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; data: string };
  projectContext?: string;
  persona?: string; // for app guides: "a friendly Mars guide"
  webAccess?: boolean; // parent allowed kid-safe web search
}

export const GameResultSchema = z.object({
  spec: GameSpecInput,
  summary: z.string(),
  aiHelped: z.array(z.string()),
});
export type GameResult = { spec: GameSpec; summary: string; aiHelped: string[] };

export const ModifyResultSchema = z.object({
  understood: z.boolean(),
  summary: z.string(),
  explanation: z.string(),
  concept: z.string(),
});

export const AppPlanSchema = z.object({
  title: z.string(),
  emoji: z.string(),
  pieces: z.array(z.object({ name: z.string(), why: z.string(), emoji: z.string() })),
  question: z.string(),
});
export type AppPlan = z.infer<typeof AppPlanSchema>;

export const AppResultSchema = z.object({ spec: AppSpecInput, summary: z.string(), aiHelped: z.array(z.string()) });
export type AppResult = { spec: AppSpec; summary: string; aiHelped: string[] };

export const DetectiveSchema = z.object({
  topic: z.string(),
  statements: z.array(z.string()),
  wrong: z.number(),
  correction: z.string(),
});
export type DetectiveCase = z.infer<typeof DetectiveSchema>;

export const CodeChangeSchema = z.object({
  understood: z.boolean(),
  source: z.string(),
  summary: z.string(),
  explanation: z.string(),
  concept: z.string(),
});
export type CodeChange = z.infer<typeof CodeChangeSchema>;

export const AgentPlanSchema = z.object({
  goal: z.string(),
  steps: z.array(z.object({ title: z.string(), request: z.string(), why: z.string() })),
});
export type AgentPlan = z.infer<typeof AgentPlanSchema>;

export const DayPlanSchema = z.object({
  title: z.string(),
  steps: z.array(z.object({ text: z.string(), when: z.string() })),
  tip: z.string(),
});
export type DayPlan = z.infer<typeof DayPlanSchema>;

export const UnderstandingSchema = z.object({ understood: z.boolean(), feedback: z.string() });
export const ModerationSchema = z.object({ safe: z.boolean(), reason: z.string() });

export interface Modification<T> {
  spec: T;
  understood: boolean;
  summary: string;
  explanation: string;
  concept: string;
}

export interface AIProvider {
  readonly name: string;
  chat(req: ChatRequest): Promise<ChatReply>;
  scene(ctx: ChildContext, prompt: string): Promise<SceneSpec>;
  story(ctx: ChildContext, prompt: string): Promise<StorySpec>;
  game(ctx: ChildContext, req: { idea: string; kind: GameKind; topicNotes: string }): Promise<GameResult>;
  modifyGame(ctx: ChildContext, spec: GameSpec, request: string): Promise<Modification<GameSpec>>;
  appPlan(ctx: ChildContext, idea: string): Promise<AppPlan>;
  app(ctx: ChildContext, req: { idea: string; plan: AppPlan; allowAiGuide: boolean }): Promise<AppResult>;
  modifyApp(ctx: ChildContext, spec: AppSpec, request: string, allowAiGuide: boolean): Promise<Modification<AppSpec>>;
  detective(ctx: ChildContext, topic: string): Promise<DetectiveCase>;
  checkUnderstanding(ctx: ChildContext, project: string, explanation: string): Promise<{ understood: boolean; feedback: string }>;
  moderate(text: string): Promise<{ safe: boolean; reason: string }>;
  modifyCode(ctx: ChildContext, source: string, request: string, error?: string): Promise<CodeChange>;
  agentPlan(ctx: ChildContext, kind: "game" | "app", spec: unknown, goal: string): Promise<AgentPlan>;
  dayPlan(ctx: ChildContext, goal: string): Promise<DayPlan>;
}
