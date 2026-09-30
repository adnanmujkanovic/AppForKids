import { all, one } from "../db";
import type { ChildProfile, CreatorLevelId, Experience, HelpLevel, Permissions } from "../../shared/types";
import { defaultPermissions } from "../../shared/types";
import type { ChildContext } from "../ai/types";

interface ChildRow {
  id: string;
  family_id: string;
  name: string;
  age: number;
  avatar: string;
  experience: string;
  interests: string;
  help_level: string;
  permissions: string;
}

export function rowToChild(r: ChildRow): ChildProfile & { familyId: string } {
  return {
    id: r.id,
    familyId: r.family_id,
    name: r.name,
    age: r.age,
    avatar: r.avatar,
    experience: r.experience as Experience,
    interests: JSON.parse(r.interests),
    helpLevel: r.help_level as HelpLevel,
    // Merge with defaults so newly added permission keys get safe values.
    permissions: { ...defaultPermissions(r.age), ...JSON.parse(r.permissions) } as Permissions,
  };
}

export function getChild(id: string) {
  const r = one<ChildRow>("SELECT * FROM children WHERE id = ?", id);
  return r ? rowToChild(r) : null;
}

export function familyChildren(familyId: string) {
  return all<ChildRow>("SELECT * FROM children WHERE family_id = ? ORDER BY created_at", familyId).map(rowToChild);
}

const count = (sql: string, ...p: (string | number)[]) => one<{ n: number }>(sql, ...p)?.n ?? 0;

export function creatorLevel(childId: string): CreatorLevelId {
  const ev = (type: string) => count("SELECT COUNT(*) AS n FROM events WHERE child_id = ? AND type = ?", childId, type);
  const projects = count("SELECT COUNT(*) AS n FROM projects WHERE child_id = ? AND deleted = 0", childId);
  const builds = count("SELECT COUNT(*) AS n FROM projects WHERE child_id = ? AND deleted = 0 AND type IN ('game','app')", childId);
  const engineer = ev("bug_fixed") >= 1 && (ev("code_viewed") >= 1 || ev("tested") >= 2);
  const aiEngineer =
    engineer &&
    ev("detective_solved") >= 1 &&
    count("SELECT COUNT(*) AS n FROM projects WHERE child_id = ? AND deleted = 0 AND spec LIKE '%\"aiGuide\"%'", childId) >= 1;
  if (aiEngineer && ev("published") + ev("shared") >= 1 && projects >= 10) return "inventor";
  if (aiEngineer) return "ai-engineer";
  if (engineer) return "engineer";
  if (builds) return "builder";
  if (projects) return "creator";
  return "explorer";
}

export function knownConcepts(childId: string): string[] {
  return all<{ concept: string }>("SELECT concept FROM skills WHERE child_id = ? ORDER BY created_at", childId).map((r) => r.concept);
}

/** The minimal context an AI call may see. No names, no family data. */
export function childContext(child: ChildProfile): ChildContext {
  return {
    age: child.age,
    experience: child.experience,
    creatorLevel: creatorLevel(child.id),
    interests: child.interests,
    helpLevel: child.helpLevel,
    knownConcepts: knownConcepts(child.id),
    homeworkMode: child.permissions.homeworkMode,
    avatar: child.avatar,
  };
}
