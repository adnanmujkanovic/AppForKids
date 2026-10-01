import { api } from "./api";
import type { HelpLevel, Permissions, ProjectSummary } from "../../../shared/types";

export interface Home {
  child: { id: string; name: string; age: number; avatar: string; interests: string[]; helpLevel: HelpLevel; permissions: Permissions };
  level: string;
  journey: { asked: boolean; image: boolean; game: boolean; played: boolean };
  notifications: { id: string; emoji: string; text: string; link: string | null; read: boolean; createdAt: string }[];
  projects: ProjectSummary[];
}

export const loadHome = () => api.get<Home>("/kid/home");

/** Web links in notifications (e.g. /kid/project/abc?tab=share) mapped to app routes. */
export function appRoute(link: string | null): string | null {
  if (!link) return null;
  const [path, query] = link.split("?");
  const tab = new URLSearchParams(query ?? "").get("tab");
  const project = path.match(/^\/kid\/project\/([\w-]+)/)?.[1];
  if (project) return `/kid/project/${project}${tab ? `?tab=${tab}` : ""}`;
  if (path.startsWith("/kid/passport")) return "/kid/passport";
  if (path.startsWith("/kid/")) return path;
  return null;
}
