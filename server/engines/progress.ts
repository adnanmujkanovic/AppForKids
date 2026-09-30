// Progress engine: records meaningful events and turns them into medals, skills and levels.
// Rewards are for creating, testing, fixing, sharing and understanding — never for screen time.
import { all, newId, now, one, run } from "../db";
import { CONCEPTS, CREATOR_LEVELS, MEDALS, type Medal } from "../../shared/types";
import { creatorLevel } from "./children";

export type EventType =
  | "asked"
  | "project_created"
  | "game_played"
  | "modified"
  | "tested"
  | "bug_fixed"
  | "restored"
  | "shared"
  | "published"
  | "remixed_by_other"
  | "remixed"
  | "detective_solved"
  | "detective_missed"
  | "explained"
  | "code_viewed"
  | "mission_complete"
  | "homework";

export interface Rewards {
  medals: Medal[];
  concepts: { name: string; emoji: string; text: string }[];
  levelUp: { id: string; emoji: string; label: string } | null;
}

export function recordEvent(
  childId: string,
  type: EventType,
  opts: { projectId?: string | null; topic?: string | null; data?: Record<string, unknown> } = {},
) {
  run(
    "INSERT INTO events (child_id, type, project_id, topic, data, created_at) VALUES (?,?,?,?,?,?)",
    childId,
    type,
    opts.projectId ?? null,
    opts.topic?.toLowerCase() ?? null,
    opts.data ? JSON.stringify(opts.data) : null,
    now(),
  );
}

export function notify(childId: string, emoji: string, text: string, link: string | null = null) {
  run("INSERT INTO notifications (id, child_id, emoji, text, link, created_at) VALUES (?,?,?,?,?,?)", newId("ntf"), childId, emoji, text, link, now());
}

const n = (sql: string, ...p: (string | number)[]) => one<{ n: number }>(sql, ...p)?.n ?? 0;

/** Each medal is a SQL-checkable behavior. */
const MEDAL_CHECKS: Record<string, (c: string) => boolean> = {
  "first-creation": (c) => n("SELECT COUNT(*) n FROM projects WHERE child_id=? AND deleted=0", c) >= 1,
  "game-maker": (c) =>
    n("SELECT COUNT(*) n FROM events e JOIN projects p ON p.id=e.project_id WHERE e.child_id=? AND e.type='game_played' AND p.child_id=e.child_id AND p.type='game'", c) >= 1,
  "app-maker": (c) => n("SELECT COUNT(*) n FROM projects WHERE child_id=? AND type='app' AND deleted=0", c) >= 1,
  "bug-hunter": (c) => n("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='bug_fixed'", c) >= 1,
  "curious-mind": (c) =>
    (one<{ n: number }>("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='asked' AND topic IS NOT NULL AND topic<>'' GROUP BY topic ORDER BY n DESC LIMIT 1", c)?.n ?? 0) >= 5,
  creator: (c) => n("SELECT COUNT(*) n FROM projects WHERE child_id=? AND type IN ('image','story') AND deleted=0", c) >= 5,
  builder: (c) => n("SELECT COUNT(*) n FROM projects WHERE child_id=? AND version>=3 AND deleted=0", c) >= 1,
  "mission-complete": (c) => n("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='mission_complete'", c) >= 1,
  experimenter: (c) =>
    n("SELECT COUNT(DISTINCT json_extract(spec,'$.kind')) n FROM projects WHERE child_id=? AND type='game' AND deleted=0", c) >= 2,
  improver: (c) =>
    n(
      `SELECT COUNT(*) n FROM events m WHERE m.child_id=? AND m.type='modified'
       AND EXISTS (SELECT 1 FROM events t WHERE t.project_id=m.project_id AND t.child_id=m.child_id AND t.type IN ('tested','game_played') AND t.id<m.id)
       AND EXISTS (SELECT 1 FROM events t WHERE t.project_id=m.project_id AND t.child_id=m.child_id AND t.type IN ('tested','game_played') AND t.id>m.id)`,
      c,
    ) >= 1,
  "ai-collaborator": (c) =>
    (one<{ n: number }>(
      "SELECT COUNT(*) n FROM events WHERE child_id=? AND type='modified' AND json_extract(data,'$.by')='ai' GROUP BY project_id ORDER BY n DESC LIMIT 1",
      c,
    )?.n ?? 0) >= 5,
  "problem-solver": (c) => n("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='bug_fixed' AND json_extract(data,'$.how')='manual'", c) >= 1,
  publisher: (c) => n("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='published'", c) >= 1,
  "first-share": (c) => n("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='shared'", c) >= 1,
  inspiration: (c) => n("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='remixed_by_other'", c) >= 1,
  "creator-milestone": (c) => n("SELECT COUNT(*) n FROM projects WHERE child_id=? AND deleted=0", c) >= 10,
  "i-broke-it": (c) => n("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='restored'", c) >= 1,
  "try-again": (c) =>
    n(
      `SELECT COUNT(*) n FROM events w WHERE w.child_id=? AND w.type='game_played' AND json_extract(w.data,'$.result')='won'
       AND EXISTS (SELECT 1 FROM events l WHERE l.child_id=w.child_id AND l.project_id=w.project_id AND l.type='game_played'
                   AND json_extract(l.data,'$.result')='lost' AND l.id<w.id)`,
      c,
    ) >= 1,
  "ai-detective": (c) => n("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='detective_solved'", c) >= 1,
  "i-understand": (c) => n("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='explained' AND json_extract(data,'$.understood')=1", c) >= 1,
  "my-idea": (c) =>
    (one<{ n: number }>(
      "SELECT COUNT(*) n FROM events WHERE child_id=? AND type='modified' AND json_extract(data,'$.by')='child' GROUP BY project_id ORDER BY n DESC LIMIT 1",
      c,
    )?.n ?? 0) >= 5,
};

export function discoverConcepts(childId: string, concepts: string[], projectId: string | null = null): Rewards["concepts"] {
  const out: Rewards["concepts"] = [];
  const child = one<{ age: number }>("SELECT age FROM children WHERE id=?", childId);
  for (const name of concepts) {
    if (!CONCEPTS[name]) continue;
    const r = run("INSERT OR IGNORE INTO skills (child_id, concept, project_id, created_at) VALUES (?,?,?,?)", childId, name, projectId, now());
    if (r.changes) {
      const info = CONCEPTS[name];
      out.push({ name, emoji: info.emoji, text: (child?.age ?? 10) <= 8 ? info.young : info.older });
    }
  }
  return out;
}

/** Evaluate medals and level after something happened. Returns only NEW rewards. */
export function evaluate(childId: string, projectId: string | null = null, concepts: string[] = []): Rewards {
  const have = new Set(all<{ medal_id: string }>("SELECT medal_id FROM medals WHERE child_id=?", childId).map((m) => m.medal_id));
  const medals: Medal[] = [];
  for (const medal of MEDALS) {
    if (have.has(medal.id) || medal.future) continue;
    const check = MEDAL_CHECKS[medal.id];
    if (check?.(childId)) {
      run("INSERT OR IGNORE INTO medals (child_id, medal_id, project_id, created_at) VALUES (?,?,?,?)", childId, medal.id, projectId, now());
      medals.push(medal);
      notify(childId, medal.emoji, `${medal.hidden ? "Surprise! " : ""}You earned the ${medal.title} medal!`, "/kid/passport");
    }
  }
  const newConcepts = discoverConcepts(childId, concepts, projectId);

  // Level-ups are stored as notifications keyed by level id, so each is announced once.
  const level = creatorLevel(childId);
  const info = CREATOR_LEVELS.find((l) => l.id === level)!;
  let levelUp: Rewards["levelUp"] = null;
  if (level !== "explorer") {
    const seen = one("SELECT 1 FROM notifications WHERE child_id=? AND link=?", childId, `/kid/passport#${level}`);
    if (!seen) {
      notify(childId, info.emoji, `Level up! You're now a ${info.label}.`, `/kid/passport#${level}`);
      levelUp = { id: info.id, emoji: info.emoji, label: info.label };
    }
  }
  return { medals, concepts: newConcepts, levelUp };
}

export function passport(childId: string) {
  const medals = all<{ medal_id: string; created_at: string }>("SELECT medal_id, created_at FROM medals WHERE child_id=? ORDER BY created_at", childId);
  const skills = all<{ concept: string; created_at: string }>("SELECT concept, created_at FROM skills WHERE child_id=? ORDER BY created_at", childId);
  const counts = all<{ type: string; n: number }>("SELECT type, COUNT(*) n FROM projects WHERE child_id=? AND deleted=0 GROUP BY type", childId);
  const by = Object.fromEntries(counts.map((c) => [c.type, c.n]));
  return {
    level: creatorLevel(childId),
    medals,
    skills,
    stats: {
      projects: counts.reduce((s, c) => s + c.n, 0),
      games: by.game ?? 0,
      apps: by.app ?? 0,
      creations: (by.image ?? 0) + (by.story ?? 0),
      bugsFixed: n("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='bug_fixed'", childId),
      shares: n("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='shared'", childId),
    },
  };
}
