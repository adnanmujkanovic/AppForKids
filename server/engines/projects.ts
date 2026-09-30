// Project engine: every significant change becomes a version; the journal records who did what.
import { all, newId, now, one, run, tx } from "../db";
import type { JournalEntry, JournalKind, Project, ProjectSpec, ProjectSummary, ProjectType, ProjectVersion } from "../../shared/types";
import type { GameSpec } from "../../shared/game";
import type { AppSpec } from "../../shared/app";
import type { CodeSpec, SceneSpec, StorySpec } from "../../shared/creations";

interface Row {
  id: string;
  child_id: string;
  type: ProjectType;
  title: string;
  emoji: string;
  idea: string;
  description: string;
  topic: string;
  spec: string;
  version: number;
  remixed_from: string | null;
  updated_at: string;
}

const toProject = (r: Row): Project & { topic: string } => ({
  id: r.id,
  childId: r.child_id,
  type: r.type,
  title: r.title,
  emoji: r.emoji,
  idea: r.idea,
  description: r.description,
  topic: r.topic,
  spec: JSON.parse(r.spec),
  version: r.version,
  remixedFrom: r.remixed_from,
  updatedAt: r.updated_at,
});

export function specTitleEmoji(type: ProjectType, spec: ProjectSpec): { title: string; emoji: string } {
  switch (type) {
    case "game": {
      const g = spec as GameSpec;
      return { title: g.title, emoji: g.player.emoji };
    }
    case "app": {
      const a = spec as AppSpec;
      return { title: a.title, emoji: a.theme.emoji };
    }
    case "image": {
      const s = spec as SceneSpec;
      return { title: s.title, emoji: s.elements[0]?.emoji ?? "🖼️" };
    }
    case "story": {
      const s = spec as StorySpec;
      return { title: s.title, emoji: s.pages[0]?.emoji ?? "📖" };
    }
    case "code": {
      const s = spec as CodeSpec;
      return { title: s.title, emoji: s.emoji };
    }
  }
}

export function createProject(
  childId: string,
  p: { type: ProjectType; idea: string; description: string; topic: string; spec: ProjectSpec; aiHelped?: string[]; remixedFrom?: string | null },
) {
  const id = newId("prj");
  const { title, emoji } = specTitleEmoji(p.type, p.spec);
  const t = now();
  tx(() => {
    run(
      "INSERT INTO projects (id, child_id, type, title, emoji, idea, description, topic, spec, version, remixed_from, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id, childId, p.type, title, emoji, p.idea.slice(0, 400), p.description.slice(0, 400), p.topic.toLowerCase().slice(0, 40),
      JSON.stringify(p.spec), 1, p.remixedFrom ?? null, t, t,
    );
    run(
      "INSERT INTO project_versions (project_id, version, spec, summary, author, created_at) VALUES (?,?,?,?,?,?)",
      id, 1, JSON.stringify(p.spec), p.remixedFrom ? "Remixed from a friend's project" : "First version", p.remixedFrom ? "child" : "ai", t,
    );
    addJournal(id, "idea", p.idea);
    for (const h of p.aiHelped ?? []) addJournal(id, "ai", h);
  });
  return getProject(id)!;
}

export function getProject(id: string) {
  const r = one<Row>("SELECT * FROM projects WHERE id = ? AND deleted = 0", id);
  return r ? toProject(r) : null;
}

/** The child's own projects plus friends' projects they were invited to build. */
export function listProjects(childId: string): (ProjectSummary & { team?: boolean })[] {
  return all<Row & { team: number }>(
    `SELECT p.*, 0 AS team FROM projects p WHERE p.child_id = ? AND p.deleted = 0
     UNION ALL
     SELECT p.*, 1 AS team FROM projects p JOIN collaborators c ON c.project_id = p.id WHERE c.child_id = ? AND p.deleted = 0
     ORDER BY updated_at DESC`,
    childId,
    childId,
  ).map((r) => ({
    team: !!r.team,
    id: r.id,
    type: r.type,
    title: r.title,
    emoji: r.emoji,
    version: r.version,
    updatedAt: r.updated_at,
    remixedFrom: r.remixed_from,
  }));
}

export function saveVersion(projectId: string, spec: ProjectSpec, summary: string, author: ProjectVersion["author"], byName: string | null = null) {
  const p = getProject(projectId);
  if (!p) throw new Error("Project not found");
  const version = p.version + 1;
  const { title, emoji } = specTitleEmoji(p.type, spec);
  const t = now();
  tx(() => {
    run("UPDATE projects SET spec=?, version=?, title=?, emoji=?, updated_at=? WHERE id=?", JSON.stringify(spec), version, title, emoji, t, projectId);
    run(
      "INSERT INTO project_versions (project_id, version, spec, summary, author, by_child, created_at) VALUES (?,?,?,?,?,?,?)",
      projectId, version, JSON.stringify(spec), summary.slice(0, 300), author, byName, t,
    );
  });
  return getProject(projectId)!;
}

export function listVersions(projectId: string): ProjectVersion[] {
  return all<{ version: number; summary: string; author: ProjectVersion["author"]; by_child: string | null; created_at: string }>(
    "SELECT version, summary, author, by_child, created_at FROM project_versions WHERE project_id=? ORDER BY version DESC",
    projectId,
  ).map((v) => ({ version: v.version, summary: v.summary, author: v.author, byName: v.by_child, createdAt: v.created_at }));
}

export function getVersionSpec(projectId: string, version: number): ProjectSpec | null {
  const r = one<{ spec: string }>("SELECT spec FROM project_versions WHERE project_id=? AND version=?", projectId, version);
  return r ? JSON.parse(r.spec) : null;
}

export function addJournal(projectId: string, kind: JournalKind, text: string) {
  if (!text.trim()) return;
  run("INSERT INTO journal (project_id, kind, text, created_at) VALUES (?,?,?,?)", projectId, kind, text.slice(0, 400), now());
}

export function getJournal(projectId: string): JournalEntry[] {
  return all<{ kind: JournalKind; text: string; created_at: string }>(
    "SELECT kind, text, created_at FROM journal WHERE project_id=? ORDER BY id",
    projectId,
  ).map((j) => ({ kind: j.kind, text: j.text, createdAt: j.created_at }));
}

export function deleteProject(projectId: string) {
  run("UPDATE projects SET deleted=1 WHERE id=?", projectId);
  run("UPDATE shares SET status='revoked' WHERE project_id=?", projectId);
}
