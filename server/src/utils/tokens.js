import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import env from "../config/env.js";

const ISSUER = "vareon-corner";
const ALG = { algorithms: ["HS256"], issuer: ISSUER };

export const ACCESS_COOKIE = "vc_at";
export const REFRESH_COOKIE = "vc_rt";

export const signAccessToken = (user) =>
  jwt.sign({ sub: String(user._id) }, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    issuer: ISSUER,
    expiresIn: env.ACCESS_TOKEN_MINUTES * 60,
  });

export const signRefreshToken = (user) => {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: String(user._id), jti }, env.JWT_REFRESH_SECRET, {
    algorithm: "HS256",
    issuer: ISSUER,
    expiresIn: env.REFRESH_TOKEN_DAYS * 86400,
  });
  return { token, jti };
};

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET, ALG);
export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET, ALG);

const baseCookie = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: "lax",
  domain: env.COOKIE_DOMAIN || undefined,
});

export function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookie(), path: "/", maxAge: env.ACCESS_TOKEN_MINUTES * 60_000 });
  // The refresh token is only ever sent to the auth endpoints.
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookie(),
    path: "/api/auth",
    maxAge: env.REFRESH_TOKEN_DAYS * 86_400_000,
  });
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie(), path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie(), path: "/api/auth" });
}
