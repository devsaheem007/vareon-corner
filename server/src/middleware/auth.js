import User from "../models/User.js";
import { ACCESS_COOKIE, verifyAccessToken } from "../utils/tokens.js";
import { AppError, asyncHandler } from "../utils/helpers.js";

async function loadUser(req) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return null;
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    return user && user.isActive ? user : null;
  } catch {
    return null;
  }
}

/** Attaches req.user when a valid session exists, but never rejects. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  req.user = await loadUser(req);
  next();
});

export const requireAuth = asyncHandler(async (req, _res, next) => {
  req.user = await loadUser(req);
  if (!req.user) throw new AppError(401, "Authentication required");
  next();
});

export const requireAdmin = [
  requireAuth,
  (req, _res, next) => (req.user.role === "admin" ? next() : next(new AppError(403, "Admin access required"))),
];
