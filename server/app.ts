import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadSession } from "./auth";
import { errorHandler } from "./http";
import { authRouter, parentRouter } from "./routes/parent";
import { kidRouter } from "./routes/kid";
import { shareRouter } from "./routes/shares";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "8mb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    // CSRF defense (with SameSite cookies): state-changing API calls must be JSON.
    if (req.path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !req.is("application/json")) {
      return res.status(415).json({ error: "JSON required" });
    }
    next();
  });
  app.use(loadSession);
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", authRouter);
  app.use("/api", shareRouter);
  app.use("/api/parent", parentRouter);
  app.use("/api/kid", kidRouter);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);

  const web = resolve("dist/web");
  if (existsSync(web)) {
    app.use(express.static(web, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(resolve(web, "index.html")));
  }
  return app;
}
