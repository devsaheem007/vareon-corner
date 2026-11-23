import crypto from "node:crypto";
import env from "../config/env.js";
import OtpToken from "../models/OtpToken.js";
import { AppError } from "./helpers.js";

const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

// Keyed hash: a leaked database alone cannot be used to recover pending codes.
const hash = (email, purpose, code) => crypto.createHmac("sha256", env.JWT_REFRESH_SECRET).update(`${email}|${purpose}|${code}`).digest("hex");

/** Creates (or replaces) the code for this e-mail + purpose and returns it for mailing. */
export async function issueOtp(email, purpose) {
  const existing = await OtpToken.findOne({ email, purpose });
  if (existing && Date.now() - existing.lastSentAt.getTime() < env.OTP_RESEND_SECONDS * 1000) {
    throw new AppError(429, `Please wait ${env.OTP_RESEND_SECONDS} seconds before requesting another code`, undefined, "OTP_COOLDOWN");
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await OtpToken.updateOne(
    { email, purpose },
    { $set: { codeHash: hash(email, purpose, code), expiresAt: new Date(Date.now() + TTL_MS), attempts: 0, lastSentAt: new Date() } },
    { upsert: true },
  );
  return code;
}

/** Throws unless the code is right, fresh and under the attempt limit. A correct code is single-use. */
export async function consumeOtp(email, purpose, code) {
  const token = await OtpToken.findOne({ email, purpose });
  if (!token || token.expiresAt.getTime() < Date.now()) throw new AppError(400, "That code has expired. Request a new one.", undefined, "OTP_EXPIRED");
  if (token.attempts >= MAX_ATTEMPTS) {
    await OtpToken.deleteOne({ _id: token._id });
    throw new AppError(429, "Too many wrong attempts. Request a new code.", undefined, "OTP_LOCKED");
  }
  const a = Buffer.from(hash(email, purpose, code));
  const b = Buffer.from(token.codeHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await OtpToken.updateOne({ _id: token._id }, { $inc: { attempts: 1 } });
    throw new AppError(400, "Incorrect code", undefined, "OTP_INVALID");
  }
  await OtpToken.deleteOne({ _id: token._id });
}
