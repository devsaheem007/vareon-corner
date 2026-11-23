import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, MailCheck, X } from "lucide-react";
import { api, ApiError, errorMessage } from "../lib/api";
import { useAuth, type User } from "../lib/auth";
import GoogleButton from "./GoogleButton";
import PasswordInput from "./PasswordInput";
import RoundLogo from "./RoundLogo";

const field = "w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none transition-colors focus:border-crimson";
type View = "in" | "up" | "verify" | "forgot" | "reset";

const rules = [
  { label: "10+ characters", ok: (p: string) => p.length >= 10 },
  { label: "Upper case", ok: (p: string) => /[A-Z]/.test(p) },
  { label: "Lower case", ok: (p: string) => /[a-z]/.test(p) },
  { label: "A number", ok: (p: string) => /\d/.test(p) },
];
const strongEnough = (p: string) => rules.every((r) => r.ok(p));

function Checklist({ password }: { password: string }) {
  return (
    <ul className="-mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      {rules.map((r) => {
        const ok = r.ok(password);
        return (
          <li key={r.label} className={`flex items-center gap-1 transition-colors ${ok ? "text-emerald-400" : "text-white/35"}`}>
            <Check size={11} className={ok ? "opacity-100" : "opacity-30"} /> {r.label}
          </li>
        );
      })}
    </ul>
  );
}

/** One sign-in for everyone: the admin e-mail lands in the admin console, every other account in its own garage. */
export default function AuthModal({
  reason,
  onClose,
  notify,
  googleClientId,
  startView = "in",
}: {
  reason?: string;
  onClose: () => void;
  notify: (m: string) => void;
  googleClientId?: string;
  startView?: "in" | "forgot";
}) {
  const { login, register, verifyEmail, resetPassword, googleLogin } = useAuth();
  const [view, setView] = useState<View>(startView);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [wait, setWait] = useState(0); // seconds until "resend" is allowed again

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  const go = (v: View) => {
    setView(v);
    setError("");
    setInfo("");
    setCode("");
  };

  const finish = (user: User, welcome: string) => {
    if (user.role === "admin") {
      window.location.assign("/admin"); // staff go straight to the console
      return;
    }
    onClose();
    notify(welcome.replace("{name}", user.name.split(" ")[0]));
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (view === "in") {
        try {
          finish(await login(email, password), "Welcome back, {name}");
        } catch (err) {
          if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
            go("verify");
            setInfo("Please confirm your email first. We've sent you a 6-digit code.");
            setWait(60);
            return;
          }
          throw err;
        }
      } else if (view === "up") {
        await register(name, email, password);
        go("verify");
        setInfo(`We sent a 6-digit code to ${email}.`);
        setWait(60);
      } else if (view === "verify") {
        finish(await verifyEmail(email, code), "Email confirmed. Welcome to Vareon, {name}");
      } else if (view === "forgot") {
        await api.post("/auth/forgot-password", { email });
        go("reset");
        setInfo(`If an account exists for ${email}, a 6-digit code is on its way.`);
        setWait(60);
      } else {
        finish(await resetPassword(email, code, password), "Password updated. Welcome back, {name}");
      }
    });
  };

  const resend = () =>
    run(async () => {
      await api.post(view === "reset" ? "/auth/forgot-password" : "/auth/resend-code", { email });
      setInfo("A new code has been sent.");
      setWait(60);
    });

  const title = { in: "Sign in", up: "Create your account", verify: "Confirm your email", forgot: "Forgot password", reset: "Choose a new password" }[view];
  const cta = { in: "Sign in", up: "Send my code", verify: "Confirm & continue", forgot: "Send reset code", reset: "Update password" }[view];
  const ready =
    view === "in" ? !!email && !!password
    : view === "up" ? !!name && !!email && strongEnough(password)
    : view === "verify" ? code.length === 6
    : view === "forgot" ? !!email
    : code.length === 6 && strongEnough(password);
  const showTabs = view === "in" || view === "up";

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto bg-black/80 p-3 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.form
        onSubmit={submit}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="my-6 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#141414] shadow-2xl will-change-transform"
      >
        <div className="flex items-start justify-between border-b border-white/8 p-5">
          <div className="flex items-center gap-3">
            <RoundLogo size={44} className="h-11 w-11" />
            <div>
              <p className="text-[9px] uppercase tracking-[.25em] text-crimson">Vareon Motors</p>
              <h3 className="font-display text-xl font-bold">{title}</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>

        <div className="p-5">
          {reason && showTabs && <p className="mb-4 rounded-xl bg-white/[.04] p-3 text-xs text-white/60">{reason}</p>}

          {showTabs && (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1 text-xs font-bold">
              {(["in", "up"] as const).map((m) => (
                <button key={m} type="button" onClick={() => go(m)} className={`rounded-lg py-2 transition-colors ${view === m ? "bg-white text-black" : "text-white/50"}`}>
                  {m === "in" ? "Sign in" : "Register"}
                </button>
              ))}
            </div>
          )}

          {!showTabs && (
            <button type="button" onClick={() => go("in")} className="mb-1 flex items-center gap-1 text-xs text-white/50 hover:text-white">
              <ArrowLeft size={14} /> Back to sign in
            </button>
          )}

          {(view === "verify" || view === "reset") && (
            <div className="mt-3 flex items-start gap-3 rounded-xl bg-white/[.04] p-3 text-xs text-white/65">
              <MailCheck size={18} className="mt-0.5 shrink-0 text-crimson" />
              <p>{info || `Enter the 6-digit code we sent to ${email}.`} It expires in 10 minutes. Check your spam folder too.</p>
            </div>
          )}
          {view === "forgot" && <p className="mt-3 text-xs text-white/55">Enter your account email and we&apos;ll send you a 6-digit code to set a new password.</p>}

          <div className="mt-4 grid gap-3">
            {view === "up" && (
              <input className={field} placeholder="Full name" autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            )}
            {(view === "in" || view === "up" || view === "forgot") && (
              <input className={field} type="email" placeholder="Email address" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
            {(view === "verify" || view === "reset") && (
              <input
                className={`${field} text-center font-display text-2xl tracking-[.5em]`}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="······"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                aria-label="6-digit code"
              />
            )}
            {(view === "in" || view === "up" || view === "reset") && (
              <PasswordInput
                className={field}
                placeholder={view === "reset" ? "New password" : "Password"}
                autoComplete={view === "in" ? "current-password" : "new-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            {(view === "up" || view === "reset") && <Checklist password={password} />}
            {view === "in" && (
              <button type="button" onClick={() => go("forgot")} className="-mt-1 w-fit text-xs text-white/50 underline-offset-2 hover:text-white hover:underline">
                Forgot password?
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-crimson/30 bg-crimson/10 p-3 text-xs text-crimson">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy || !ready} className="mt-5 w-full rounded-xl bg-crimson py-3.5 font-bold transition-opacity disabled:opacity-30">
            {busy ? "Please wait…" : cta}
          </button>

          {(view === "verify" || view === "reset") && (
            <button type="button" onClick={resend} disabled={busy || wait > 0} className="mt-3 w-full text-center text-xs text-white/55 hover:text-white disabled:opacity-40">
              {wait > 0 ? `Resend code in ${wait}s` : "Didn't get it? Resend code"}
            </button>
          )}

          {showTabs && googleClientId && (
            <>
              <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[.25em] text-white/30">
                <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
              </div>
              <GoogleButton
                clientId={googleClientId}
                onCredential={(cred) => void run(async () => finish(await googleLogin(cred), "Welcome, {name}"))}
              />
            </>
          )}
        </div>
      </motion.form>
    </motion.div>
  );
}
