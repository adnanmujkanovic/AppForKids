// GitHub connector: a parent connects their account; children can save projects as
// repositories and (if public publishing is allowed) deploy them with GitHub Pages.
import { HttpError } from "../http";

type Fetch = typeof fetch;
let fetchImpl: Fetch = (...a) => fetch(...a);
/** For tests. */
export function setGithubFetch(f: Fetch) {
  fetchImpl = f;
}

const API = "https://api.github.com";

async function gh<T>(token: string, method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<{ status: number; data: T }> {
  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "SparkForge-Kids",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok && !okStatuses.includes(res.status)) {
    const msg = (data as { message?: string })?.message ?? res.statusText;
    throw new HttpError(res.status === 401 ? 400 : 502, `GitHub said: ${msg}`);
  }
  return { status: res.status, data };
}

export async function githubUser(token: string) {
  const { data } = await gh<{ login: string }>(token, "GET", "/user");
  if (!data.login) throw new HttpError(400, "That token didn't work with GitHub.");
  return data.login;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

async function putFile(token: string, owner: string, repo: string, path: string, content: string, message: string) {
  const existing = await gh<{ sha?: string }>(token, "GET", `/repos/${owner}/${repo}/contents/${path}`, undefined, [404]);
  await gh(token, "PUT", `/repos/${owner}/${repo}/contents/${path}`, {
    message,
    content: b64(content),
    ...(existing.status === 200 && existing.data.sha ? { sha: existing.data.sha } : {}),
  });
}

export interface DeployInput {
  token: string;
  owner: string;
  repo: string;
  description: string;
  isPublic: boolean;
  files: Record<string, string>;
  message: string;
  create: boolean;
}

/** Creates the repo if needed, commits the files, and turns on Pages for public repos. */
export async function deploy(input: DeployInput) {
  const { token, owner, repo } = input;
  if (input.create) {
    const created = await gh<{ name: string }>(token, "POST", "/user/repos", {
      name: repo,
      description: input.description.slice(0, 300),
      private: !input.isPublic,
      auto_init: true,
    }, [422]);
    if (created.status === 422) {
      // Name already taken: reuse it only if it is the child's SparkForge repo.
      const check = await gh<{ description?: string }>(token, "GET", `/repos/${owner}/${repo}`);
      if (!check.data.description?.includes("SparkForge")) throw new HttpError(409, "A different repository already uses that name.");
    }
  }
  for (const [path, content] of Object.entries(input.files)) await putFile(token, owner, repo, path, content, input.message);
  let pagesUrl: string | null = null;
  if (input.isPublic) {
    await gh(token, "POST", `/repos/${owner}/${repo}/pages`, { source: { branch: "main", path: "/" } }, [409, 422]);
    pagesUrl = `https://${owner.toLowerCase()}.github.io/${repo}/`;
  }
  return { repoUrl: `https://github.com/${owner}/${repo}`, pagesUrl };
}
