import crypto from "node:crypto";
import mongoose from "mongoose";

export class AppError extends Error {
  constructor(status, message, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code; // machine-readable, e.g. "EMAIL_NOT_VERIFIED"
    this.expose = true;
  }
}

/** Wraps an async route handler so rejected promises reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

/** Escapes a string for safe use inside a RegExp (search boxes etc.). */
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case-insensitive "contains" filter (the pattern is escaped, so user input can never inject regex syntax). */
export const containsFilter = (s) => mongoose.trusted({ $regex: escapeRegex(s), $options: "i" });

/** Prevents spreadsheet formula injection when exporting CSV. */
export function csvCell(value) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
