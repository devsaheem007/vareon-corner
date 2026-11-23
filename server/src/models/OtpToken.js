import mongoose from "mongoose";
import env from "../config/env.js";

// One live code per (email, purpose). Only a keyed hash of the code is stored, never the code itself.
const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true },
    purpose: { type: String, enum: ["verify", "reset"], required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true }, // expiry is always checked in code; the TTL index below only tidies up
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
otpSchema.index({ email: 1, purpose: 1 }, { unique: true });
// MongoDB deletes expired codes automatically (skipped in tests: the stand-in test database lacks TTL support).
if (!env.isTest && !process.env.NO_TTL_INDEX) otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("OtpToken", otpSchema);
