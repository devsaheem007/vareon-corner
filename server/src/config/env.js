import "dotenv/config";
import crypto from "node:crypto";
import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),

    PORT: z.coerce.number().int().min(1).max(65535).default(5000),

    MONGODB_URI: z
      .string()
      .min(1)
      .default("mongodb://127.0.0.1:27017/vareon_corner"),

    CLIENT_URL: z.string().default("http://localhost:5173"),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT_ACCESS_SECRET must be at least 32 characters")
      .optional(),

    JWT_REFRESH_SECRET: z
      .string()
      .min(32, "JWT_REFRESH_SECRET must be at least 32 characters")
      .optional(),

    ACCESS_TOKEN_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(7),

    COOKIE_DOMAIN: z.string().optional(),

    TRUST_PROXY: z.coerce
      .number()
      .int()
      .min(0)
      .default(isProd ? 1 : 0),

    ADMIN_NAME: z.string().default("Showroom Admin"),
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().optional(),

    SOCIAL_INSTAGRAM: z.string().optional(),
    SOCIAL_FACEBOOK: z.string().optional(),
    SOCIAL_YOUTUBE: z.string().optional(),
    SOCIAL_TIKTOK: z.string().optional(),
    SOCIAL_X: z.string().optional(),
    SOCIAL_LINKEDIN: z.string().optional(),
    WHATSAPP_NUMBER: z.string().optional(),

    // SMTP
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_SECURE: z.enum(["true", "false"]).default("false"),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().optional(),

    APP_URL: z.string().default("http://localhost:5173"),
    OTP_RESEND_SECONDS: z.coerce.number().int().min(0).default(60),

    // Google sign-in
    GOOGLE_CLIENT_ID: z.string().optional(),

    // Cloudinary
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const smtpCount = [data.SMTP_HOST, data.SMTP_USER, data.SMTP_PASS].filter(
      (value) => value?.trim(),
    ).length;

    if (smtpCount > 0 && smtpCount < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_HOST"],
        message:
          "SMTP_HOST, SMTP_USER and SMTP_PASS must be configured together",
      });
    }

    if (data.NODE_ENV === "production" && smtpCount !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_HOST"],
        message: "Complete SMTP configuration is required in production",
      });
    }

    const cloudinaryCount = [
      data.CLOUDINARY_CLOUD_NAME,
      data.CLOUDINARY_API_KEY,
      data.CLOUDINARY_API_SECRET,
    ].filter((value) => value?.trim()).length;

    if (cloudinaryCount > 0 && cloudinaryCount < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CLOUDINARY_CLOUD_NAME"],
        message: "All three Cloudinary credentials must be configured together",
      });
    }

    if (data.NODE_ENV === "production" && cloudinaryCount !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CLOUDINARY_CLOUD_NAME"],
        message: "Complete Cloudinary configuration is required in production",
      });
    }

    if (data.NODE_ENV === "production") {
      // Production MongoDB URL validation
      try {
        const databaseUrl = new URL(data.MONGODB_URI);

        const protocolAllowed = ["mongodb:", "mongodb+srv:"].includes(
          databaseUrl.protocol,
        );

        const hostname = databaseUrl.hostname
          .replace(/^\[|\]$/g, "")
          .toLowerCase();

        const isLoopback =
          hostname === "localhost" ||
          hostname === "::1" ||
          /^127(?:\.\d{1,3}){3}$/.test(hostname);

        if (!protocolAllowed || !hostname || isLoopback) {
          throw new Error("Invalid production MongoDB URL");
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["MONGODB_URI"],
          message: "A valid non-local MongoDB URL is required in production",
        });
      }

      // Production application URL must use HTTPS
      try {
        const appUrl = new URL(data.APP_URL);

        if (appUrl.protocol !== "https:" || !appUrl.hostname) {
          throw new Error("HTTPS required");
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["APP_URL"],
          message: "APP_URL must be a valid HTTPS URL in production",
        });
      }

      // Every production frontend origin must use HTTPS
      for (const origin of data.CLIENT_URL.split(",")
        .map((value) => value.trim())
        .filter(Boolean)) {
        try {
          const clientUrl = new URL(origin);

          if (clientUrl.protocol !== "https:" || !clientUrl.hostname) {
            throw new Error("HTTPS required");
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["CLIENT_URL"],
            message: `Client origin must be a valid HTTPS URL: ${origin}`,
          });
        }
      }
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");

  for (const issue of parsed.error.issues) {
    console.error(` - ${issue.path.join(".")}: ${issue.message}`);
  }

  process.exit(1);
}

const env = { ...parsed.data };

if (isProd) {
  if (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET) {
    console.error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required in production.",
    );
    process.exit(1);
  }

  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    console.error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.",
    );
    process.exit(1);
  }
} else {
  // Development convenience only: sessions reset when the server restarts.
  if (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET) {
    console.warn(
      "[env] JWT secrets not set - using ephemeral development secrets.",
    );

    env.JWT_ACCESS_SECRET ??= crypto.randomBytes(48).toString("hex");
    env.JWT_REFRESH_SECRET ??= crypto.randomBytes(48).toString("hex");
  }
}

env.isProd = isProd;
env.isTest = env.NODE_ENV === "test";

env.clientOrigins = env.CLIENT_URL.split(",")
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter(Boolean);

export default Object.freeze(env);
