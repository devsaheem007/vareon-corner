import rateLimit from "express-rate-limit";
import env from "../config/env.js";

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit: env.isTest ? 10_000 : limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { status: "error", message },
  });

export const apiLimiter = make(15 * 60_000, 600, "Too many requests, please slow down.");
export const authLimiter = make(15 * 60_000, 20, "Too many authentication attempts. Try again in 15 minutes.");
export const formLimiter = make(60 * 60_000, 30, "Too many submissions from this address. Please try again later.");
