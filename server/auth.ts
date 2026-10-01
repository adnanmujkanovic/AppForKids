// Parent-first authentication. Parents sign in; children enter through a parent's session
// and leaving child mode requires the parent password again.
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { newToken, now, one, run } from "./db";

export interface Session {
  token: string;
  role: "parent" | "child";
  familyId: string;
  parentId: string | null;
  childId: string | null;
}

declare module "express-serve-static-core" {
  interface Request {
    session?: Session;
  }
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(pw, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

const COOKIE = "sf_session";
const DAYS = 30;

export function startSession(res: Response, s: Omit<Session, "token">): Session {
  const token = newToken();
  const expires = new Date(Date.now() + DAYS * 864e5);
  run(
    "INSERT INTO sessions (token, role, family_id, parent_id, child_id, created_at, expires_at) VALUES (?,?,?,?,?,?,?)",
    token, s.role, s.familyId, s.parentId, s.childId, now(), expires.toISOString(),
  );
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  });
  return { token, ...s };
}

export function endSession(req: Request, res: Response) {
  if (req.session) run("DELETE FROM sessions WHERE token = ?", req.session.token);
  res.clearCookie(COOKIE, { path: "/" });
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** Native apps send the session token as a bearer header instead of a cookie. */
export const isNativeClient = (req: Request) => req.get("x-sparkforge-client") === "native";

export function loadSession(req: Request, _res: Response, next: NextFunction) {
  const bearer = req.get("authorization")?.match(/^Bearer\s+([\w-]{20,})$/)?.[1];
  const token = bearer ?? readCookie(req, COOKIE);
  if (token) {
    const r = one<{ token: string; role: Session["role"]; family_id: string; parent_id: string | null; child_id: string | null; expires_at: string }>(
      "SELECT * FROM sessions WHERE token = ?",
      token,
    );
    if (r && r.expires_at > now()) {
      req.session = { token: r.token, role: r.role, familyId: r.family_id, parentId: r.parent_id, childId: r.child_id };
    }
  }
  next();
}

export function requireParent(req: Request, res: Response, next: NextFunction) {
  if (req.session?.role !== "parent") return res.status(401).json({ error: "Parent sign-in required" });
  next();
}

export function requireChild(req: Request, res: Response, next: NextFunction) {
  if (req.session?.role !== "child" || !req.session.childId) return res.status(401).json({ error: "Child session required" });
  next();
}

/** Tiny in-memory throttle for login attempts. */
const attempts = new Map<string, { n: number; until: number }>();
export function throttled(key: string): boolean {
  const a = attempts.get(key);
  return !!a && a.n >= 8 && a.until > Date.now();
}
export function noteFailure(key: string) {
  const a = attempts.get(key);
  const fresh = !a || a.until < Date.now();
  attempts.set(key, { n: fresh ? 1 : a!.n + 1, until: Date.now() + 15 * 60e3 });
}
export function clearFailures(key: string) {
  attempts.delete(key);
}
