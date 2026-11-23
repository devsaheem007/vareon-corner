import { AppError } from "../utils/helpers.js";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF guard for cookie-authenticated requests: every state-changing call must carry a custom
 * header. Browsers cannot send custom headers cross-origin without a CORS pre-flight, and our CORS
 * policy only allows the configured origins. Combined with SameSite=Lax cookies this blocks CSRF.
 */
export default function csrfGuard(req, _res, next) {
  if (SAFE.has(req.method)) return next();
  if (req.get("x-requested-with") !== "XMLHttpRequest") {
    return next(new AppError(403, "Missing or invalid request header"));
  }
  next();
}
