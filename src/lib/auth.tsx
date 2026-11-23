import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";

export type User = { _id: string; name: string; email: string; role: "customer" | "admin"; favorites: number[] };

/** Marker (not a secret): "this browser has signed in before". Lets visitors skip a pointless /auth/me call. */
export const SESSION_FLAG = "vareon-session";
const setFlag = (on: boolean) => {
  try {
    if (on) localStorage.setItem(SESSION_FLAG, "1");
    else localStorage.removeItem(SESSION_FLAG);
  } catch {
    /* private mode */
  }
};
const hasFlag = () => {
  try {
    return localStorage.getItem(SESSION_FLAG) === "1";
  } catch {
    return false;
  }
};

type Ctx = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  /** Starts sign-up: the server e-mails a 6-digit code. No session exists until verifyEmail succeeds. */
  register: (name: string, email: string, password: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<User>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<User>;
  googleLogin: (credential: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
};
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!hasFlag());

  useEffect(() => {
    if (!hasFlag()) return;
    api
      .get<{ user: User }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setFlag(false))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ user: User }>("/auth/login", { email, password });
    setFlag(true);
    setUser(r.user);
    return r.user;
  }, []);
  const start = useCallback((u: User) => {
    setFlag(true);
    setUser(u);
    return u;
  }, []);
  const register = useCallback(async (name: string, email: string, password: string) => {
    await api.post("/auth/register", { name, email, password });
  }, []);
  const verifyEmail = useCallback(async (email: string, code: string) => start((await api.post<{ user: User }>("/auth/verify-email", { email, code })).user), [start]);
  const resetPassword = useCallback(
    async (email: string, code: string, newPassword: string) => start((await api.post<{ user: User }>("/auth/reset-password", { email, code, newPassword })).user),
    [start],
  );
  const googleLogin = useCallback(async (credential: string) => start((await api.post<{ user: User }>("/auth/google", { credential })).user), [start]);
  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setFlag(false);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, ready, login, register, verifyEmail, resetPassword, googleLogin, logout, setUser }), [user, ready, login, register, verifyEmail, resetPassword, googleLogin, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}
