import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ROLES } from "../config/constants.js";

const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "customer" },
    isActive: { type: Boolean, default: true },
    // Accounts created before verification existed read as verified (default true); new sign-ups start false.
    emailVerified: { type: Boolean, default: true },
    googleId: { type: String, index: true, sparse: true },
    favorites: { type: [Number], default: [] },
    failedLogins: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    lastLoginAt: Date,
    // SHA-256 hashes of live refresh tokens: one entry per session, rotated on every refresh.
    // (Expiry is enforced by the JWT's own `exp` claim.)
    refreshTokens: { type: [String], default: [], select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.refreshTokens;
        delete ret.failedLogins;
        delete ret.lockUntil;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);
userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// A real hash used to equalise timing when the e-mail does not exist.
export const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

export default mongoose.model("User", userSchema);
