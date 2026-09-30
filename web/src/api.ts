// Tiny typed fetch wrapper for the SparkForge API.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public safety = false,
  ) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    credentials: "same-origin",
    headers: method === "GET" ? undefined : { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong", !!data.safety);
  return data as T;
}

export const api = {
  get: <T>(url: string) => call<T>("GET", url),
  post: <T>(url: string, body: unknown = {}) => call<T>("POST", url, body),
  put: <T>(url: string, body: unknown) => call<T>("PUT", url, body),
  patch: <T>(url: string, body: unknown) => call<T>("PATCH", url, body),
  del: <T>(url: string) => call<T>("DELETE", url),
};

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
