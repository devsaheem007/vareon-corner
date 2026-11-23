import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDB, disconnectDB } from "./config/db.js";
import env from "./config/env.js";
import { smtpConfigured } from "./utils/mailer.js";

async function main() {
  await connectDB();
  // Build indexes (unique e-mail, booking slot lock, ...) before accepting traffic.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  if (env.isProd && !smtpConfigured) console.error("[mail] SMTP is NOT configured: sign-up codes and alerts cannot be delivered. Set SMTP_HOST / SMTP_USER / SMTP_PASS.");
  if (!env.isProd && !smtpConfigured) console.log("[mail] No SMTP configured - emails (codes, alerts) will be printed in this terminal.");
  const server = createApp().listen(env.PORT, () => {
    console.log(`Vareon API listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received - shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
