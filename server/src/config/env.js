import "dotenv/config";
import crypto from "node:crypto";
import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/vareon_corner"),
  // Comma separated list of browser origins allowed to call the API (CORS).
  CLIENT_URL: z.string().default("http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters").optional(),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters").optional(),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  COOKIE_DOMAIN: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).default(isProd ? 1 : 0),
  // Used only by `npm run seed` to create the first admin account.
  ADMIN_NAME: z.string().default("Showroom Admin"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  // Optional defaults for social links / contact, written by the seed script.
  SOCIAL_INSTAGRAM: z.string().optional(),
  SOCIAL_FACEBOOK: z.string().optional(),
  SOCIAL_YOUTUBE: z.string().optional(),
  SOCIAL_TIKTOK: z.string().optional(),
  SOCIAL_X: z.string().optional(),
  SOCIAL_LINKEDIN: z.string().optional(),
  WHATSAPP_NUMBER: z.string().optional(),
  // ---- e-mail (SMTP). Without these, codes/alerts are printed to the server console in development. ----
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  APP_URL: z.string().default("http://localhost:5173"),
  OTP_RESEND_SECONDS: z.coerce.number().int().min(0).default(60),
  // ---- Google sign-in ----
  GOOGLE_CLIENT_ID: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) console.error(` - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

const env = { ...parsed.data };

if (isProd) {
  if (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET) {
    console.error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required in production.");
    process.exit(1);
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    console.error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.");
    process.exit(1);
  }
} else {
  // Development convenience only: random per-process secrets (sessions reset on restart).
  if (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET) {
    console.warn("[env] JWT secrets not set - using ephemeral development secrets.");
    env.JWT_ACCESS_SECRET ??= crypto.randomBytes(48).toString("hex");
    env.JWT_REFRESH_SECRET ??= crypto.randomBytes(48).toString("hex");
  }
}

env.isProd = isProd;
env.isTest = env.NODE_ENV === "test";
env.clientOrigins = env.CLIENT_URL.split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);

export default Object.freeze(env);
