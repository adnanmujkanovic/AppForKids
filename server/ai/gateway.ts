// AI Gateway: the single boundary between the product and any model provider.
// Application -> Gateway -> [cost controls, provider routing, output safety, logging, fallback].
import { now, one, run } from "../db";
import { checkText } from "../safety";
import { ClaudeProvider, RefusalError } from "./anthropic";
import { OfflineProvider } from "./offline";
import type { AIProvider, ChildContext } from "./types";

export class LimitError extends Error {}
export class SafetyBlockError extends Error {}

export interface GatewayResult<T> {
  data: T;
  provider: string;
  note?: string;
}

function pickProvider(): AIProvider {
  const mode = process.env.SPARKFORGE_AI ?? "auto";
  if (mode === "offline") return new OfflineProvider();
  if (mode === "claude" || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return new ClaudeProvider();
  return new OfflineProvider();
}

let primary: AIProvider = pickProvider();
const offline = new OfflineProvider();

export const gatewayInfo = () => ({ provider: primary.name, live: primary.name !== "offline" });

/** For tests: swap the primary provider. */
export function setProvider(p: AIProvider) {
  primary = p;
}

/** Collect every string in a result so output safety can scan it. */
function strings(x: unknown, out: string[] = []): string[] {
  if (typeof x === "string") out.push(x);
  else if (Array.isArray(x)) x.forEach((v) => strings(v, out));
  else if (x && typeof x === "object") Object.values(x).forEach((v) => strings(v, out));
  return out;
}

export function aiUsageToday(childId: string): number {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  return one<{ n: number }>("SELECT COUNT(*) AS n FROM ai_log WHERE child_id = ? AND created_at >= ?", childId, since.toISOString())!.n;
}

export async function callAI<T>(
  op: string,
  childId: string | null,
  ctx: ChildContext | null,
  limit: number | null,
  fn: (p: AIProvider) => Promise<T>,
): Promise<GatewayResult<T>> {
  if (childId && limit !== null && aiUsageToday(childId) >= limit) {
    throw new LimitError("You've done a LOT of creating today! Your AI helper is resting until tomorrow. 🌙 You can still play and build by yourself.");
  }
  const started = Date.now();
  const log = (provider: string, ok: boolean, usage?: { input: number; output: number }) =>
    run(
      "INSERT INTO ai_log (child_id, op, provider, ok, ms, input_tokens, output_tokens, created_at) VALUES (?,?,?,?,?,?,?,?)",
      childId,
      op,
      provider,
      ok ? 1 : 0,
      Date.now() - started,
      usage?.input ?? null,
      usage?.output ?? null,
      now(),
    );

  let result: GatewayResult<T>;
  try {
    const data = await fn(primary);
    log(primary.name, true, primary instanceof ClaudeProvider ? primary.lastUsage : undefined);
    result = { data, provider: primary.name };
  } catch (err) {
    log(primary.name, false);
    if (primary === offline) throw err;
    const refused = err instanceof RefusalError;
    console.warn(`[ai] ${op} failed on ${primary.name}:`, (err as Error).message);
    const data = await fn(offline);
    result = {
      data,
      provider: offline.name,
      note: refused
        ? "The AI couldn't help with that one, so I used a simpler helper."
        : "The AI service is having trouble, so I used offline practice mode for this one.",
    };
  }

  // Output safety: scan every string the model produced.
  const age = ctx?.age ?? 10;
  for (const s of strings(result.data)) {
    const verdict = checkText(s, age, "output");
    if (verdict.verdict === "block") {
      if (childId) {
        run(
          "INSERT INTO safety_events (id, child_id, severity, category, summary, excerpt, created_at) VALUES (?,?,?,?,?,?,?)",
          `sfe_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
          childId,
          "medium",
          "ai-output",
          `An AI response was withheld by the safety filter (${op}).`,
          "",
          now(),
        );
      }
      throw new SafetyBlockError("Hmm, that answer didn't pass our safety check. Let's try asking in a different way!");
    }
  }
  return result;
}
