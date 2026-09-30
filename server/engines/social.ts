// Friends and collaboration. Friendships exist only between children whose parents both agreed:
// one parent creates a friend code for their child, the other parent enters it for theirs.
import { all, one } from "../db";

export const isCollaborator = (projectId: string, childId: string) =>
  !!one("SELECT 1 FROM collaborators WHERE project_id=? AND child_id=?", projectId, childId);

export const areFriends = (a: string, b: string) => !!one("SELECT 1 FROM friends WHERE child_id=? AND friend_id=?", a, b);

export function friendsOf(childId: string) {
  return all<{ id: string; name: string; avatar: string }>(
    "SELECT c.id, c.name, c.avatar FROM friends f JOIN children c ON c.id = f.friend_id WHERE f.child_id=? ORDER BY c.name",
    childId,
  );
}

export function collaboratorsOf(projectId: string) {
  return all<{ id: string; name: string; avatar: string; role: string }>(
    "SELECT c.id, c.name, c.avatar, k.role FROM collaborators k JOIN children c ON c.id = k.child_id WHERE k.project_id=? ORDER BY k.created_at",
    projectId,
  );
}

export function tasksOf(projectId: string) {
  return all<{ id: string; text: string; assignee: string | null; done: number }>(
    "SELECT id, text, assignee, done FROM project_tasks WHERE project_id=? ORDER BY created_at",
    projectId,
  ).map((t) => ({ ...t, done: !!t.done }));
}

export function reactionsOf(projectId: string) {
  return all<{ kind: string; value: string; n: number }>(
    "SELECT kind, value, COUNT(*) n FROM reactions WHERE project_id=? GROUP BY kind, value ORDER BY n DESC",
    projectId,
  );
}

/** Kind, preset comments friends may choose from (no free text between children). */
export const PRESET_COMMENTS = [
  "This is so cool! 🤩",
  "How did you make it?",
  "I love the colors! 🎨",
  "Can you add more levels? 🪜",
  "It made me laugh! 😂",
  "I learned something new! 💡",
  "Great idea! 🌟",
  "Let's build one together! 🤝",
];
export const REACTIONS = ["🤩", "😂", "🔥", "💡", "🚀", "❤️"];
