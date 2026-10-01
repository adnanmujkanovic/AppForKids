import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadSession } from "./auth";
import { errorHandler } from "./http";
import { authRouter, parentRouter } from "./routes/parent";
import { kidRouter } from "./routes/kid";
import { shareRouter } from "./routes/shares";
import { kidSocialRouter, parentSocialRouter, publicSocialRouter } from "./routes/social";
import { kidExtrasRouter, parentExtrasRouter } from "./routes/extras";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "8mb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    // CSRF defense (with SameSite cookies): state-changing API calls must be JSON.
    // (Cross-site DELETE already requires a CORS preflight, which this API never grants.)
    if (req.path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS", "DELETE"].includes(req.method) && !req.is("application/json")) {
      return res.status(415).json({ error: "JSON required" });
    }
    next();
  });
  // Optional CORS for development clients (e.g. the Expo web preview). Native apps don't need CORS.
  const corsOrigins = (process.env.SPARKFORGE_CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  if (corsOrigins.length) {
    app.use("/api", (req, res, next) => {
      const origin = req.get("origin");
      if (origin && corsOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, x-sparkforge-client");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        if (req.method === "OPTIONS") return res.status(204).end();
      }
      next();
    });
  }
  app.use(loadSession);
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", authRouter);
  app.use("/api", shareRouter);
  app.use("/api", publicSocialRouter);
  app.use("/api/parent", parentRouter);
  app.use("/api/parent", parentSocialRouter);
  app.use("/api/kid", kidRouter);
  app.use("/api/kid", kidSocialRouter);
  app.use("/api/parent", parentExtrasRouter);
  app.use("/api/kid", kidExtrasRouter);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);

  const web = resolve("dist/web");
  if (existsSync(web)) {
    app.use(
      express.static(web, {
        index: false,
        maxAge: "1h",
        setHeaders: (res, file) => {
          if (file.endsWith("sw.js") || file.endsWith(".webmanifest")) res.setHeader("Cache-Control", "no-cache");
          else if (file.includes("/assets/")) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        },
      }),
    );
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(resolve(web, "index.html")));
  }
  return app;
}
