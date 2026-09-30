import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { LimitError, SafetyBlockError } from "./ai/gateway";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const forbid = (message: string) => new HttpError(403, message);
export const notFound = (what = "Not found") => new HttpError(404, what);

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;

/** Wrap a handler: returns JSON from the return value and maps known errors. */
export const h = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json(out ?? { ok: true });
  } catch (err) {
    next(err);
  }
};

export function body<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  const r = schema.safeParse(req.body);
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  return r.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof LimitError) return res.status(429).json({ error: err.message });
  if (err instanceof SafetyBlockError) return res.status(422).json({ error: err.message, safety: true });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side. Please try again." });
}
