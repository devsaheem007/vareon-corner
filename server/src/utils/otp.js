import crypto from "node:crypto";
import mongoose from "mongoose";
import env from "../config/env.js";
import OtpToken from "../models/OtpToken.js";
import { AppError } from "./helpers.js";

const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

// Keyed hash: a leaked database alone cannot be used to recover pending codes.
const hash = (email, purpose, code) =>
  crypto
    .createHmac("sha256", env.JWT_REFRESH_SECRET)
    .update(`${email}|${purpose}|${code}`)
    .digest("hex");

/** Creates (or replaces) the code for this e-mail + purpose and returns it for mailing. */
export async function issueOtp(email, purpose) {
  const existing = await OtpToken.findOne({ email, purpose });

  if (
    existing &&
    Date.now() - existing.lastSentAt.getTime() < env.OTP_RESEND_SECONDS * 1000
  ) {
    throw new AppError(
      429,
      `Please wait ${env.OTP_RESEND_SECONDS} seconds before requesting another code`,
      undefined,
      "OTP_COOLDOWN",
    );
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

  await OtpToken.updateOne(
    { email, purpose },
    {
      $set: {
        codeHash: hash(email, purpose, code),
        expiresAt: new Date(Date.now() + TTL_MS),
        attempts: 0,
        lastSentAt: new Date(),
      },
    },
    { upsert: true },
  );

  return code;
}

/** Throws unless the code is right, fresh and under the attempt limit.
 * A correct code can only be consumed once, including concurrent requests.
 */
export async function consumeOtp(email, purpose, code) {
  const now = new Date();
  const token = await OtpToken.findOne({ email, purpose });

  if (!token || token.expiresAt <= now) {
    throw new AppError(
      400,
      "That code has expired. Request a new one.",
      undefined,
      "OTP_EXPIRED",
    );
  }

  if (token.attempts >= MAX_ATTEMPTS) {
    await OtpToken.deleteOne({
      _id: token._id,
      attempts: mongoose.trusted({ $gte: MAX_ATTEMPTS }),
    });

    throw new AppError(
      429,
      "Too many wrong attempts. Request a new code.",
      undefined,
      "OTP_LOCKED",
    );
  }

  const suppliedHash = Buffer.from(hash(email, purpose, code));
  const storedHash = Buffer.from(token.codeHash);

  if (
    suppliedHash.length !== storedHash.length ||
    !crypto.timingSafeEqual(suppliedHash, storedHash)
  ) {
    const result = await OtpToken.updateOne(
      {
        _id: token._id,
        expiresAt: mongoose.trusted({ $gt: now }),
        attempts: mongoose.trusted({ $lt: MAX_ATTEMPTS }),
      },
      { $inc: { attempts: 1 } },
    );

    if (result.modifiedCount === 1) {
      throw new AppError(400, "Incorrect code", undefined, "OTP_INVALID");
    }

    const current = await OtpToken.findById(token._id).select(
      "expiresAt attempts",
    );

    if (!current || current.expiresAt <= new Date()) {
      throw new AppError(
        400,
        "That code has expired. Request a new one.",
        undefined,
        "OTP_EXPIRED",
      );
    }

    if (current.attempts >= MAX_ATTEMPTS) {
      await OtpToken.deleteOne({ _id: current._id });

      throw new AppError(
        429,
        "Too many wrong attempts. Request a new code.",
        undefined,
        "OTP_LOCKED",
      );
    }

    throw new AppError(400, "Incorrect code", undefined, "OTP_INVALID");
  }

  // Atomic deletion: only one simultaneous request can consume this code.
  const consumed = await OtpToken.findOneAndDelete({
    _id: token._id,
    codeHash: token.codeHash,
    expiresAt: mongoose.trusted({ $gt: now }),
    attempts: mongoose.trusted({ $lt: MAX_ATTEMPTS }),
  });

  if (!consumed) {
    const current = await OtpToken.findById(token._id).select(
      "expiresAt attempts",
    );

    if (!current || current.expiresAt <= new Date()) {
      throw new AppError(
        400,
        "That code has expired. Request a new one.",
        undefined,
        "OTP_EXPIRED",
      );
    }

    if (current.attempts >= MAX_ATTEMPTS) {
      await OtpToken.deleteOne({ _id: current._id });

      throw new AppError(
        429,
        "Too many wrong attempts. Request a new code.",
        undefined,
        "OTP_LOCKED",
      );
    }

    throw new AppError(400, "Incorrect code", undefined, "OTP_INVALID");
  }
}
