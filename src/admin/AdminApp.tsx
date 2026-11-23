import PasswordInput from "../components/PasswordInput";
import NotificationBell from "../components/NotificationBell";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Car, CalendarDays, Inbox, LayoutDashboard, LogOut, Mail, Settings, Users } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import RoundLogo from "../components/RoundLogo";
import { BrandLoader } from "../components/SplashScreen";
import { SESSION_FLAG } from "../lib/auth";
import { Btn, Field, ToastProvider, inputCls, useToast } from "./ui";
import type { AdminUser } from "./types";
import Overview from "./panels/Overview";
import CarsPanel from "./panels/CarsPanel";
import BookingsPanel from "./panels/BookingsPanel";
import InquiriesPanel from "./panels/InquiriesPanel";
import SubscribersPanel from "./panels/SubscribersPanel";
import UsersPanel from "./panels/UsersPanel";
import SettingsPanel from "./panels/SettingsPanel";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "cars", label: "Vehicles", icon: Car },
  { id: "bookings", label: "Test Drives", icon: CalendarDays },
  { id: "inquiries", label: "Inquiries", icon: Inbox },
  { id: "subscribers", label: "Subscribers", icon: Mail },
  { id: "users", label: "Users", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
] as const;
type TabId = (typeof TABS)[number]["id"];

const Screen = ({ children }: { children: React.ReactNode }) => (
  <div className="grid-bg flex min-h-screen items-center justify-center bg-ink px-4 text-white">{children}</div>
);

function Login({ onLogin }: { onLogin: (u: AdminUser) => void }) {
  const notify = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<{ user: AdminUser }>("/auth/login", { email, password });
      onLogin(r.user);
    } catch (err) {
      notify(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Screen>
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-sm rounded-[2rem] p-8 shadow-2xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <RoundLogo size={104} priority className="shadow-2xl shadow-black" />
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[.3em] text-crimson">Staff access</p>
          <h1 className="font-display text-2xl font-bold">Showroom Console</h1>
        </div>
        <div className="grid gap-4">
          <Field label="Email">
            <input className={inputCls} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <PasswordInput className={inputCls} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>
        <Btn type="submit" disabled={busy || !email || !password} className="mt-6 w-full py-3.5">
          {busy ? "Signing in…" : "Sign in"}
        </Btn>
        <a href="/?forgot=1" className="mt-4 block text-center text-xs text-white/50 hover:text-white">Forgot password?</a>
        <a href="/" className="mt-3 block text-center text-xs text-white/40 hover:text-white">← Back to showroom</a>
      </motion.form>
    </Screen>
  );
}

function Dashboard({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  const readTab = (): TabId => {
    const h = window.location.hash.slice(1) as TabId;
    return TABS.some((t) => t.id === h) ? h : "overview";
  };
  const notify = useToast();
  const [tab, setTab] = useState<TabId>(readTab);
  useEffect(() => {
    const on = () => setTab(readTab());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (t: TabId) => {
    window.location.hash = t;
    setTab(t);
  };
  // remember this browser belongs to staff, so the public site can show a "back to admin" button
  useEffect(() => {
    try { localStorage.setItem(SESSION_FLAG, "1"); } catch { /* private mode */ }
  }, []);
  const logout = async () => {
    try { await api.post("/auth/logout"); } finally {
      try { localStorage.removeItem(SESSION_FLAG); } catch { /* ignore */ }
      onLogout();
    }
  };

  return (
    <div className="min-h-screen bg-ink text-white lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="glass border-0 border-b border-white/10 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 p-4 lg:p-6">
          <RoundLogo size={44} priority className="h-11 w-11" />
          <div className="leading-tight">
            <p className="font-display text-base font-bold">Vareon Console</p>
            <p className="text-[10px] uppercase tracking-[.2em] text-white/35">{user.name}</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:grid lg:px-4 lg:pb-0" aria-label="Admin sections">
          {TABS.map(({ id, label, icon: I }) => (
            <button
              key={id}
              onClick={() => go(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold ${tab === id ? "bg-white font-bold text-black" : "text-white/55 hover:bg-white/5"}`}
            >
              <I size={16} /> {label}
            </button>
          ))}
        </nav>
        <div className="hidden gap-2 p-4 lg:absolute lg:bottom-0 lg:left-0 lg:right-0 lg:grid">
          <a href="/" className="rounded-xl px-3 py-2.5 text-xs text-white/50 hover:bg-white/5">View showroom ↗</a>
          <button onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-white/50 hover:bg-white/5">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-6 lg:p-10">
        <div className="mb-6 flex items-center justify-between gap-4 lg:justify-end">
          <a href="/" className="text-xs text-white/50 lg:hidden">View showroom ↗</a>
          <div className="flex items-center gap-4">
            <NotificationBell
              notify={notify}
              onOpenLink={(link) => {
                const t = link.split("#")[1] as TabId | undefined;
                if (t && TABS.some((x) => x.id === t)) go(t);
              }}
            />
            <button onClick={logout} className="flex items-center gap-2 text-xs text-white/50 lg:hidden"><LogOut size={14} /> Sign out</button>
          </div>
        </div>
        {tab === "overview" && <Overview go={go} />}
        {tab === "cars" && <CarsPanel />}
        {tab === "bookings" && <BookingsPanel />}
        {tab === "inquiries" && <InquiriesPanel />}
        {tab === "subscribers" && <SubscribersPanel />}
        {tab === "users" && <UsersPanel me={user} />}
        {tab === "settings" && <SettingsPanel />}
      </main>
    </div>
  );
}

function Gate() {
  const [user, setUser] = useState<AdminUser | null | undefined>(undefined);
  useEffect(() => {
    api.get<{ user: AdminUser }>("/auth/me").then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <Screen><BrandLoader label="Checking session" /></Screen>;
  if (!user) return <Login onLogin={setUser} />;
  if (user.role !== "admin") {
    return (
      <Screen>
        <div className="glass max-w-sm rounded-[2rem] p-8 text-center">
          <RoundLogo size={72} className="mx-auto" />
          <h1 className="mt-5 font-display text-xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-white/50">Signed in as {user.email}, which is not a staff account.</p>
          <Btn className="mt-6 w-full" onClick={async () => { await api.post("/auth/logout").catch(() => {}); setUser(null); }}>Sign out</Btn>
        </div>
      </Screen>
    );
  }
  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}

export default function AdminApp() {
  useEffect(() => {
    document.title = "Console — VAREON MOTORS";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  return (
    <ToastProvider>
      <Gate />
    </ToastProvider>
  );
}
