import fs from "node:fs";
import path from "node:path";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import env from "./config/env.js";
import { CLIENT_DIST, UPLOAD_DIR } from "./config/paths.js";
import csrfGuard from "./middleware/csrf.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import sanitize from "./middleware/sanitize.js";
import routes from "./routes/index.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", ...(env.GOOGLE_CLIENT_ID ? ["https://accounts.google.com/gsi/client"] : [])],
          frameSrc: env.GOOGLE_CLIENT_ID ? ["https://accounts.google.com/gsi/"] : ["'none'"],
          // Tailwind/Framer Motion set inline style attributes; Google Fonts CSS is already used by the site.
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", ...(env.GOOGLE_CLIENT_ID ? ["https://accounts.google.com/gsi/style"] : [])],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: ["'self'", ...(env.GOOGLE_CLIENT_ID ? ["https://accounts.google.com/gsi/"] : [])],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: env.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      // Google's sign-in popup needs this (the default "same-origin" would block it).
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    }),
  );

  // Same-origin requests are always allowed; other origins must be listed in CLIENT_URL.
  app.use(
    cors((req, cb) => {
      const origin = req.get("origin");
      const sameOrigin = origin && origin === `${req.protocol}://${req.get("host")}`;
      const allowed = !origin || sameOrigin || env.clientOrigins.includes(origin);
      cb(allowed ? null : new Error("Not allowed by CORS"), {
        origin: allowed,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", "X-Requested-With"],
        maxAge: 600,
      });
    }),
  );

  app.use(compression());
  if (!env.isTest) app.use(morgan(env.isProd ? "combined" : "dev"));
  app.use(express.json({ limit: "50kb" }));
  app.use(cookieParser());
  app.use(sanitize);

  app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
      index: false,
      dotfiles: "deny",
      maxAge: "7d",
      setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
    }),
  );

  app.use("/api", apiLimiter, csrfGuard, routes);
  app.use("/api", notFound);

  // Production: serve the built React app from the same origin (cookies stay first-party).
  if (fs.existsSync(path.join(CLIENT_DIST, "index.html"))) {
    app.use("/assets", express.static(path.join(CLIENT_DIST, "assets"), { immutable: true, maxAge: "1y", index: false }));
    app.use(express.static(CLIENT_DIST, { maxAge: "1h", index: false }));
    app.get(/^(?!\/api\/|\/uploads\/).*/, (_req, res) => {
      res.set("Cache-Control", "no-cache");
      res.sendFile(path.join(CLIENT_DIST, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
