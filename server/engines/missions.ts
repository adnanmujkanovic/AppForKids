// Missions: guided, project-based challenges. Steps complete automatically from real activity.
import { all, one } from "../db";
import { MISSIONS } from "../../shared/types";
import { TOPICS } from "../ai/knowledge";
import { recordEvent } from "./progress";

interface P {
  id: string;
  type: string;
  topic: string;
  title: string;
  idea: string;
  spec: string;
}

const keywordsFor = (topic: string) => TOPICS.find((t) => t.id === topic)?.keywords ?? [topic];

function related(p: P, topic: string) {
  if (topic === "any") return true;
  const hay = `${p.topic} ${p.title} ${p.idea}`.toLowerCase();
  return keywordsFor(topic).some((k) => hay.includes(k));
}

function checkStep(childId: string, check: string, projects: P[]): boolean {
  const [kind, a, b] = check.split(":");
  const count = (sql: string, ...params: string[]) => one<{ n: number }>(sql, childId, ...params)?.n ?? 0;
  const eventsOn = (type: string, topic: string) => {
    const ids = new Set(projects.filter((p) => related(p, topic)).map((p) => p.id));
    return all<{ project_id: string }>("SELECT project_id FROM events WHERE child_id=? AND type=?", childId, type).filter((e) =>
      ids.has(e.project_id),
    ).length;
  };
  switch (kind) {
    case "ask": {
      const rows = all<{ topic: string | null; data: string | null }>("SELECT topic, data FROM events WHERE child_id=? AND type='asked'", childId);
      const kws = keywordsFor(a);
      return rows.filter((r) => kws.some((k) => `${r.topic ?? ""} ${r.data ?? ""}`.toLowerCase().includes(k))).length >= Number(b);
    }
    case "image":
      return projects.some((p) => p.type === "image" && related(p, a));
    case "game":
      return projects.some((p) => p.type === "game" && related(p, a));
    case "app":
      return projects.some((p) => p.type === "app" && related(p, a));
    case "modified":
      return eventsOn("modified", b) >= 1;
    case "facts":
      return projects.some(
        (p) => p.type === "game" && related(p, a) && JSON.parse(p.spec).collectibles.filter((c: { fact: string }) => c.fact.trim()).length >= Number(b),
      );
    case "aiguide":
      return projects.some((p) => p.type === "app" && related(p, a) && p.spec.includes('"aiGuide"'));
    case "tested":
      return eventsOn("tested", a) >= Number(b);
    case "shared":
      return a === "app"
        ? all<{ project_id: string }>("SELECT project_id FROM events WHERE child_id=? AND type='shared'", childId).some((e) =>
            projects.some((p) => p.id === e.project_id && p.type === "app"),
          )
        : eventsOn("shared", a) >= 1;
    case "gamekind":
      return projects.some((p) => p.type === "game" && JSON.parse(p.spec).kind === a);
    case "played":
      return count("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='game_played'") >= Number(a);
    case "fixed":
      return count("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='bug_fixed'") >= Number(a);
    case "appblock":
      return projects.some((p) => p.type === "app" && p.spec.includes(`"type":"${a}"`));
    case "appitems":
      return projects.some(
        (p) => p.type === "app" && JSON.parse(p.spec).collections.reduce((s: number, c: { items: unknown[] }) => s + c.items.length, 0) >= Number(a),
      );
    case "detective":
      return count("SELECT COUNT(*) n FROM events WHERE child_id=? AND type='detective_solved'") >= Number(a);
    default:
      return false;
  }
}

export function missionProgress(childId: string) {
  const projects = all<P>("SELECT id, type, topic, title, idea, spec FROM projects WHERE child_id=? AND deleted=0", childId);
  return MISSIONS.map((m) => {
    const steps = m.steps.map((s) => ({ ...s, done: checkStep(childId, s.check, projects) }));
    const complete = steps.every((s) => s.done);
    return { id: m.id, steps, complete, current: steps.findIndex((s) => !s.done) };
  });
}

/** Mark newly completed missions. Returns ids completed right now. */
export function settleMissions(childId: string): string[] {
  const done = new Set(
    all<{ data: string }>("SELECT data FROM events WHERE child_id=? AND type='mission_complete'", childId).map((e) => JSON.parse(e.data).mission),
  );
  const fresh: string[] = [];
  for (const m of missionProgress(childId)) {
    if (m.complete && !done.has(m.id)) {
      recordEvent(childId, "mission_complete", { data: { mission: m.id } });
      fresh.push(m.id);
    }
  }
  return fresh;
}
