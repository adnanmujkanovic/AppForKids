// Safety Engine: the first and last line around every AI interaction.
// Rules here are deterministic and fast; the AI layer adds its own safety prompt on top.
import { newId, now, run } from "./db";

export type Verdict = "allow" | "redact" | "block" | "support";
export type Severity = "low" | "medium" | "high";

export interface SafetyResult {
  verdict: Verdict;
  category: string | null;
  severity: Severity | null;
  cleanText: string;
  childMessage: string | null;
}

interface Rule {
  category: string;
  verdict: Exclude<Verdict, "allow" | "redact">;
  severity: Severity;
  patterns: RegExp[];
  message: string;
  minAge?: number; // rule is skipped for children at or above this age
}

const RULES: Rule[] = [
  {
    category: "wellbeing",
    verdict: "support",
    severity: "high",
    patterns: [
      /\b(kill|hurt|cut|harm)\s+my\s*self\b/i,
      /\bi\s+(want|wanna)\s+to\s+die\b/i,
      /\bsuicid/i,
      /\bnobody\s+(would\s+)?(care|miss)\s+if\s+i\b/i,
      /\bend\s+my\s+life\b/i,
    ],
    message:
      "It sounds like you might be going through something really hard. You matter a lot. Please talk to a grown-up you trust — like a parent, teacher or school counselor — right now. You don't have to handle big feelings alone. 💛",
  },
  {
    category: "stranger-contact",
    verdict: "block",
    severity: "medium",
    patterns: [
      /\b(meet|meeting)\s+(up|me|in\s+person)\b/i,
      /\bsend\s+(me\s+)?(a\s+)?(photo|pic|picture|selfie)s?\s+of\s+(you|yourself)\b/i,
      /\bare\s+you\s+(home\s+)?alone\b/i,
      /\bkeep\s+(it|this)\s+(a\s+)?secret\s+from\s+(your|my)\s+(mom|dad|parents?)\b/i,
    ],
    message:
      "That's something to always check with a grown-up first. SparkForge doesn't help with meeting people or sending personal photos — let's get back to creating! 🚀",
  },
  {
    category: "weapons",
    verdict: "block",
    severity: "medium",
    patterns: [
      /\bhow\s+(do\s+i|to|can\s+i)\s+(make|build|get)\s+(a\s+)?(real\s+)?(bomb|gun|explosive|weapon|poison)s?\b/i,
      /\b(make|build)\s+(a\s+)?(real\s+)?(bomb|explosive)s?\b/i,
    ],
    message:
      "I can't help with making real weapons or dangerous things. But I'd love to help you design a space defense game or learn how rockets work! 🛸",
  },
  {
    category: "adult-content",
    verdict: "block",
    severity: "high",
    patterns: [/\b(porn|nude|naked|sex|sexy|xxx|onlyfans)\b/i],
    message: "That's not something I can help with here. Let's make something awesome instead! 🎨",
  },
  {
    category: "substances",
    verdict: "block",
    severity: "medium",
    patterns: [/\bhow\s+(do\s+i|to|can\s+i)\s+(get\s+drunk|get\s+high|buy\s+(vapes?|alcohol|beer|weed))\b/i, /\bvape\s+tricks\b/i],
    message: "That's a question for a trusted grown-up. Want to learn how the human body works instead? 🧬",
  },
  {
    category: "unkind-words",
    verdict: "block",
    severity: "low",
    patterns: [/\b(fuck|shit|bitch|bastard|asshole|dickhead|cunt)\w*/i],
    message: "Let's keep our words kind — SparkForge is a friendly place. Try asking in a different way! 😊",
  },
];

// Phone numbers: 7+ digits, excluding math like "120 - 45 - 3" (spaced operators).
const phoneReplace = (m: string) =>
  (m.match(/\d/g) ?? []).length >= 7 && !/\s[-.]\s/.test(m) ? "[phone hidden]" : m;

const PII: { name: string; re: RegExp; replace: string | ((m: string) => string) }[] = [
  { name: "email", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replace: "[email hidden]" },
  { name: "phone", re: /(?<!\w)(\+?\d[\d\s().-]{7,}\d)(?!\w)/g, replace: phoneReplace },
  {
    name: "address",
    re: /\b\d{1,5}\s+(?:[A-Z]?[a-z]+\s){1,3}(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd|way|court|ct)\b\.?/gi,
    replace: "[address hidden]",
  },
  { name: "password", re: /\b(my\s+)?password\s+(is|:)\s*\S+/gi, replace: "[password hidden]" },
  { name: "school", re: /\b(i\s+go\s+to|my\s+school\s+is)\s+[A-Z][\w'-]*(\s+[A-Z][\w'-]*){0,4}/g, replace: "[school hidden]" },
  { name: "live-at", re: /\bi\s+live\s+(at|on)\s+[^.,!?\n]{3,40}/gi, replace: "[location hidden]" },
];

export function redactPII(text: string): string {
  let clean = text;
  for (const p of PII) clean = typeof p.replace === "string" ? clean.replace(p.re, p.replace) : clean.replace(p.re, p.replace);
  return clean;
}

/** Check text written by a child (input) or produced by AI (output). */
export function checkText(text: string, age: number, direction: "input" | "output" = "input"): SafetyResult {
  for (const rule of RULES) {
    if (rule.minAge !== undefined && age >= rule.minAge) continue;
    if (rule.patterns.some((p) => p.test(text))) {
      // Wellbeing language inside AI output (e.g. a supportive answer) is not a problem.
      if (direction === "output" && rule.verdict === "support") continue;
      return {
        verdict: rule.verdict,
        category: rule.category,
        severity: rule.severity,
        cleanText: "",
        childMessage: rule.message,
      };
    }
  }
  const clean = direction === "input" ? redactPII(text) : text;
  if (clean !== text) {
    return {
      verdict: "redact",
      category: "personal-info",
      severity: "low",
      cleanText: clean,
      childMessage:
        "🔒 Quick safety tip: I hid some personal info (like an address, phone number or school). It's best never to share those online — even with AI!",
    };
  }
  return { verdict: "allow", category: null, severity: null, cleanText: text, childMessage: null };
}

/** Persist a safety event so it can surface on the parent dashboard. */
export function recordSafetyEvent(childId: string, result: SafetyResult, source: string, original: string) {
  if (result.verdict === "allow" || !result.category || !result.severity) return;
  const summaries: Record<string, string> = {
    wellbeing: "Your child wrote something that may signal they are upset or unsafe. Please check in with them.",
    "stranger-contact": "A message looked like contact with a stranger (meeting up, photos or secrets). It was blocked.",
    weapons: "A request about making dangerous items was blocked.",
    "adult-content": "A request for adult content was blocked.",
    substances: "A request about alcohol or drugs was blocked.",
    "unkind-words": "Unkind language was used and the message was blocked.",
    "personal-info": "Personal information was typed and automatically hidden before reaching AI.",
    "ai-output": "An AI response was withheld by the safety filter.",
  };
  // Parents see a short excerpt, not the whole conversation — with personal info removed.
  const excerpt = redactPII(result.verdict === "redact" ? result.cleanText : original).slice(0, 140);
  run(
    "INSERT INTO safety_events (id, child_id, severity, category, summary, excerpt, created_at) VALUES (?,?,?,?,?,?,?)",
    newId("sfe"),
    childId,
    result.severity,
    result.category,
    `${summaries[result.category] ?? "Safety filter triggered."} (${source})`,
    excerpt,
    now(),
  );
}
