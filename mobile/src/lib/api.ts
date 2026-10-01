// API client for the SparkForge server. Native apps authenticate with a bearer token.
import Constants from "expo-constants";
import { getItem, setItem } from "./storage";

const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "http://localhost:3001";

let baseUrl = DEFAULT_URL;
let token: string | null = null;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function loadConnection() {
  baseUrl = (await getItem("sf_server")) ?? DEFAULT_URL;
  token = await getItem("sf_token");
}

export const serverUrl = () => baseUrl;

export async function setServerUrl(url: string) {
  baseUrl = url.replace(/\/+$/, "") || DEFAULT_URL;
  await setItem("sf_server", baseUrl === DEFAULT_URL ? null : baseUrl);
}

export async function setToken(t: string | null) {
  token = t;
  await setItem("sf_token", t);
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api${path}`, {
      method,
      credentials: "omit",
      headers: {
        "x-sparkforge-client": "native",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(method === "GET" ? {} : { "content-type": "application/json" }),
      },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError(0, `Can't reach the SparkForge server at ${baseUrl}. Check your internet connection.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Something went wrong");
  return data as T;
}

export const api = {
  get: <T>(path: string) => call<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => call<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => call<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => call<T>("PATCH", path, body),
  del: <T>(path: string) => call<T>("DELETE", path),
};

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
