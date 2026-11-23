/**
 * Idempotent seed:  npm run seed            -> settings + cars (only if empty) + admin (if env set)
 *                   npm run seed -- --reset-cars   -> wipe and re-import the 31 showroom cars
 */
import fs from "node:fs";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/db.js";
import env from "../config/env.js";
import Car from "../models/Car.js";
import { ensureSequenceAtLeast } from "../models/Counter.js";
import Settings from "../models/Settings.js";
import User from "../models/User.js";
import { password as passwordRule } from "../validators/schemas.js";

const carsData = JSON.parse(fs.readFileSync(new URL("./cars.json", import.meta.url), "utf8"));

export async function seedCars({ reset = false } = {}) {
  if (reset) await Car.deleteMany({});
  if ((await Car.countDocuments({})) === 0) await Car.insertMany(carsData.map((c) => ({ ...c, isActive: true })));
  await ensureSequenceAtLeast("car", Math.max(...carsData.map((c) => c.id)));
  return Car.countDocuments({});
}

export async function seedSettings() {
  const existing = await Settings.findOne({ key: "site" });
  if (existing) return existing;
  return Settings.create({
    key: "site",
    social: {
      instagram: env.SOCIAL_INSTAGRAM || "",
      facebook: env.SOCIAL_FACEBOOK || "",
      youtube: env.SOCIAL_YOUTUBE || "",
      tiktok: env.SOCIAL_TIKTOK || "",
      x: env.SOCIAL_X || "",
      linkedin: env.SOCIAL_LINKEDIN || "",
    },
    whatsapp: env.WHATSAPP_NUMBER || "",
  });
}

export async function seedAdmin(email = env.ADMIN_EMAIL, plain = env.ADMIN_PASSWORD, name = env.ADMIN_NAME) {
  if (!email || !plain) return null;
  const check = passwordRule.safeParse(plain);
  if (!check.success) throw new Error(`ADMIN_PASSWORD too weak: ${check.error.issues[0].message}`);
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing?.role === "admin") return existing; // already set up: never touch an existing admin
  const passwordHash = await User.hashPassword(plain);
  if (existing) {
    // The address was registered before the admin was seeded. The person running the seed owns this server,
    // so the account is reset to THEIR password and any old sessions are revoked (no hand-over to a squatter).
    existing.set({ name, passwordHash, role: "admin", emailVerified: true, isActive: true, refreshTokens: [], googleId: undefined });
    return existing.save();
  }
  return User.create({ name, email, passwordHash, role: "admin", emailVerified: true });
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  try {
    await connectDB();
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    const total = await seedCars({ reset: process.argv.includes("--reset-cars") });
    await seedSettings();
    const admin = await seedAdmin();
    console.log(`Seed complete: ${total} cars, settings ready, admin ${admin ? admin.email : "NOT created (set ADMIN_EMAIL / ADMIN_PASSWORD)"}`);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}
