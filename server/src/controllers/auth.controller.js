import bcrypt from "bcryptjs";
import env from "../config/env.js";
import crypto from "node:crypto";
import User, { DUMMY_HASH } from "../models/User.js";
import { passwordChangedEmail, otpEmail } from "../utils/emails.js";
import { google } from "../utils/google.js";
import { mailAvailable, sendMail, sendMailSafe } from "../utils/mailer.js";
import { notifyAdmins } from "../utils/notify.js";
import { consumeOtp, issueOtp } from "../utils/otp.js";
import { AppError, asyncHandler, sha256 } from "../utils/helpers.js";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens.js";

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60_000;

async function issueSession(_req, res, user) {
  const access = signAccessToken(user);
  const { token: refresh } = signRefreshToken(user);
  await User.updateOne(
    { _id: user._id },
    {
      $push: {
        // at most 5 concurrent sessions per account
        refreshTokens: { $each: [sha256(refresh)], $slice: -5 },
      },
    },
  );
  setAuthCookies(res, access, refresh);
}

async function sendOtpMail(user, purpose) {
  const code = await issueOtp(user.email, purpose);
  try {
    await sendMail({ to: user.email, ...otpEmail(user.name, code, purpose) });
  } catch (err) {
    console.error("[mail] could not send code:", err.message);
    throw new AppError(
      502,
      "We couldn't send the email right now. Please try again in a moment.",
      undefined,
      "MAIL_FAILED",
    );
  }
}

const requireMail = () => {
  if (!mailAvailable())
    throw new AppError(
      503,
      "Email service is not configured. Please contact the showroom.",
      undefined,
      "MAIL_DISABLED",
    );
};

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  // The configured admin e-mail can only ever be created by the seed script, never by public sign-up.
  if (env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.toLowerCase())
    throw new AppError(409, "An account with this email already exists");
  requireMail();

  const existing = await User.findOne({ email });
  if (existing?.emailVerified)
    throw new AppError(409, "An account with this email already exists");

  // An UNVERIFIED account proves nothing about who owns the address, so a new attempt simply replaces it.
  const passwordHash = await User.hashPassword(password);
  let user = existing;
  if (user) {
    user.set({ name, passwordHash });
    user.refreshTokens = [];
    await user.save();
  } else {
    user = await User.create({
      name,
      email,
      passwordHash,
      role: "customer",
      emailVerified: false,
    });
  }
  await sendOtpMail(user, "verify");
  res.status(202).json({ needsVerification: true, email });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email });
  if (!user)
    throw new AppError(400, "Incorrect code", undefined, "OTP_INVALID");
  await consumeOtp(email, "verify", code);
  const first = !user.emailVerified;
  user.emailVerified = true;
  await user.save();
  await issueSession(req, res, user);
  if (first) {
    await notifyAdmins({
      type: "account",
      title: "New customer account",
      body: `${user.name} · ${user.email}`,
      link: "/admin#users",
    });
  }
  res.json({ user });
});

export const resendOtp = asyncHandler(async (req, res) => {
  requireMail();
  const user = await User.findOne({ email: req.body.email });
  if (user && !user.emailVerified) {
    try {
      await sendOtpMail(user, "verify");
    } catch (err) {
      if (err.code !== "OTP_COOLDOWN") throw err;
    }
  }
  res.json({
    message:
      "If that account is waiting for confirmation, a new code is on its way.",
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  requireMail();
  const user = await User.findOne({ email: req.body.email });
  if (user?.isActive) {
    try {
      await sendOtpMail(user, "reset");
    } catch (err) {
      if (err.code !== "OTP_COOLDOWN" && err.code !== "MAIL_FAILED") throw err; // never reveal whether the account exists
    }
  }
  res.json({
    message: "If an account exists for that email, we've sent a 6-digit code.",
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;
  await consumeOtp(email, "reset", code);
  const user = await User.findOne({ email }).select(
    "+failedLogins +lockUntil +refreshTokens",
  );
  if (!user || !user.isActive)
    throw new AppError(400, "Incorrect code", undefined, "OTP_INVALID");
  user.passwordHash = await User.hashPassword(newPassword);
  user.emailVerified = true; // they just proved they own the inbox
  user.refreshTokens = []; // sign out every other device
  user.failedLogins = 0;
  user.lockUntil = undefined;
  await user.save();
  await issueSession(req, res, user);
  sendMailSafe({ to: user.email, ...passwordChangedEmail(user.name) });
  res.json({ user });
});

export const googleLogin = asyncHandler(async (req, res) => {
  if (!google.enabled())
    throw new AppError(
      503,
      "Google sign-in is not configured",
      undefined,
      "GOOGLE_DISABLED",
    );
  let info;
  try {
    info = await google.verify(req.body.credential);
  } catch {
    throw new AppError(401, "Google sign-in failed. Please try again.");
  }
  if (!info.emailVerified || !info.email)
    throw new AppError(401, "Your Google email is not verified");

  let user = await User.findOne({
    $or: [{ googleId: info.sub }, { email: info.email }],
  }).select("+passwordHash");
  if (!user) {
    if (env.ADMIN_EMAIL && info.email === env.ADMIN_EMAIL.toLowerCase()) {
      throw new AppError(
        403,
        "The admin account has not been created yet. Run the seed script first.",
      );
    }
    // No password exists for Google accounts; store an unguessable one so the field stays valid.
    user = await User.create({
      name: info.name,
      email: info.email,
      googleId: info.sub,
      emailVerified: true,
      role: "customer",
      passwordHash: await User.hashPassword(
        crypto.randomBytes(32).toString("hex"),
      ),
    });
    await notifyAdmins({
      type: "account",
      title: "New customer account",
      body: `${user.name} · ${user.email} (Google)`,
      link: "/admin#users",
    });
  } else {
    if (!user.isActive) throw new AppError(401, "This account is disabled");
    // Google has verified this address, so linking is safe and it also settles any pending e-mail check.
    await User.updateOne(
      { _id: user._id },
      { $set: { googleId: info.sub, emailVerified: true } },
    );
    user.emailVerified = true;
  }
  await User.updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: new Date() } },
  );
  await issueSession(req, res, user);
  res.json({ user });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select(
    "+passwordHash +failedLogins +lockUntil",
  );

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH); // equalise timing so e-mails can't be enumerated
    throw new AppError(401, "Invalid email or password");
  }
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    throw new AppError(
      429,
      "Too many failed attempts. This account is locked for a few minutes.",
    );
  }

  const ok = await user.verifyPassword(password);
  if (!ok || !user.isActive) {
    const failed = (user.failedLogins || 0) + 1;
    await User.updateOne(
      { _id: user._id },
      failed >= MAX_FAILED
        ? {
            $set: {
              failedLogins: 0,
              lockUntil: new Date(Date.now() + LOCK_MS),
            },
          }
        : { $set: { failedLogins: failed } },
    );
    throw new AppError(401, "Invalid email or password");
  }

  if (!user.emailVerified) {
    // Right password but the address was never confirmed: send a fresh code and let the UI ask for it.
    try {
      await sendOtpMail(user, "verify");
    } catch {
      /* cooldown or mail hiccup: the UI still offers "resend" */
    }
    throw new AppError(
      403,
      "Please confirm your email first. We've sent you a code.",
      undefined,
      "EMAIL_NOT_VERIFIED",
    );
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: { failedLogins: 0, lastLoginAt: new Date() },
      $unset: { lockUntil: "" },
    },
  );
  await issueSession(req, res, user);
  res.json({ user });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];

  if (!token) throw new AppError(401, "Session expired");

  let payload;

  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearAuthCookies(res);
    throw new AppError(401, "Session expired");
  }

  const hash = sha256(token);

  // Atomically consume the stored token hash.
  // A concurrent request cannot successfully consume the same token.
  const user = await User.findOneAndUpdate(
    {
      _id: payload.sub,
      isActive: true,
      refreshTokens: hash,
    },
    {
      $pull: { refreshTokens: hash },
    },
    { new: true },
  );

  if (!user) {
    // Preserve the existing replay-detection policy:
    // an already-used valid refresh token revokes all sessions.
    const existingUser = await User.findById(payload.sub);

    if (existingUser) {
      await User.updateOne(
        { _id: existingUser._id },
        { $set: { refreshTokens: [] } },
      );
    }

    clearAuthCookies(res);
    throw new AppError(401, "Session expired");
  }

  await issueSession(req, res, user);
  res.json({ user });
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const { sub } = verifyRefreshToken(token);
      await User.updateOne(
        { _id: sub },
        { $pull: { refreshTokens: sha256(token) } },
      );
    } catch {
      /* token already invalid - nothing to revoke */
    }
  }
  clearAuthCookies(res);
  res.json({ message: "Signed out" });
});

export const me = (req, res) => res.json({ user: req.user });

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+passwordHash");
  if (!(await user.verifyPassword(currentPassword)))
    throw new AppError(401, "Current password is incorrect");
  user.passwordHash = await User.hashPassword(newPassword);
  user.refreshTokens = []; // sign out every other device
  await user.save();
  await issueSession(req, res, user);
  sendMailSafe({ to: user.email, ...passwordChangedEmail(user.name) });
  res.json({ message: "Password updated" });
});

export const updateProfile = asyncHandler(async (req, res) => {
  req.user.name = req.body.name;
  await req.user.save();
  res.json({ user: req.user });
});

export const getFavorites = (req, res) =>
  res.json({ favorites: req.user.favorites });

export const setFavorites = asyncHandler(async (req, res) => {
  req.user.favorites = [...new Set(req.body.favorites)];
  await req.user.save();
  res.json({ favorites: req.user.favorites });
});
