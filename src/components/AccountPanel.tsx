import PasswordInput from "./PasswordInput";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Heart, Inbox, LogOut, Shield, User as UserIcon, X } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Car } from "../lib/types";

export type AccountTab = "saved" | "drives" | "requests" | "profile";

type Booking = { _id: string; carId: number; carName: string; date: string; time: string; location: string; status: string };
type Inquiry = { _id: string; type: string; carName?: string; status: string; createdAt: string; message?: string; finance?: { monthly: number; down: number; rate: number; years: number } };

const TABS: { id: AccountTab; label: string; icon: typeof Heart }[] = [
  { id: "saved", label: "Saved cars", icon: Heart },
  { id: "drives", label: "Test drives", icon: CalendarDays },
  { id: "requests", label: "Requests", icon: Inbox },
  { id: "profile", label: "Profile", icon: UserIcon },
];
const TONE: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-300",
  confirmed: "bg-emerald-400/10 text-emerald-300",
  completed: "bg-sky-400/10 text-sky-300",
  cancelled: "bg-white/5 text-white/40",
  new: "bg-crimson/15 text-crimson",
  contacted: "bg-amber-400/10 text-amber-300",
  closed: "bg-white/5 text-white/40",
};
const Pill = ({ s }: { s: string }) => (
  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${TONE[s] ?? "bg-white/5 text-white/50"}`}>{s}</span>
);
const input = "w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-crimson";
const Empty = ({ children }: { children: string }) => <p className="rounded-2xl bg-white/[.03] p-8 text-center text-sm text-white/40">{children}</p>;

export default function AccountPanel({
  tab: initialTab,
  cars,
  saved,
  onToggleSaved,
  onBook,
  onClose,
  onLogout,
  notify,
}: {
  tab: AccountTab;
  cars: Car[];
  saved: number[];
  onToggleSaved: (id: number) => void;
  onBook: (carId: number) => void;
  onClose: () => void;
  onLogout: () => void;
  notify: (m: string) => void;
}) {
  const { user, setUser, logout } = useAuth();
  const [tab, setTab] = useState<AccountTab>(initialTab);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null);
  const [name, setName] = useState(user?.name ?? "");
  const [pw, setPw] = useState({ cur: "", next: "" });

  const loadBookings = useCallback(() => {
    api.get<{ bookings: Booking[] }>("/bookings/mine").then((r) => setBookings(r.bookings)).catch((e) => notify(errorMessage(e)));
  }, [notify]);

  useEffect(() => {
    if (tab === "drives") loadBookings();
    if (tab === "requests") api.get<{ inquiries: Inquiry[] }>("/inquiries/mine").then((r) => setInquiries(r.inquiries)).catch((e) => notify(errorMessage(e)));
  }, [tab, loadBookings, notify]);

  if (!user) return null;
  const savedCars = cars.filter((c) => saved.includes(c.id));

  return (
    <motion.div
      className="fixed inset-0 z-[85] flex items-end justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-md sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        className="my-6 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#141414] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/8 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-crimson font-display text-lg font-bold">{user.name.charAt(0).toUpperCase()}</span>
            <div>
              <p className="text-[9px] uppercase tracking-[.25em] text-crimson">Your garage</p>
              <h3 className="font-display text-xl font-bold leading-tight">{user.name}</h3>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"><X /></button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-white/8 px-3 py-2">
          {TABS.map(({ id, label, icon: I }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold ${tab === id ? "bg-white font-bold text-black" : "text-white/55 hover:bg-white/5"}`}>
              <I size={14} /> {label}
              {id === "saved" && saved.length > 0 && <b className="rounded-full bg-crimson px-1.5 text-[9px] text-white">{saved.length}</b>}
            </button>
          ))}
        </div>

        <div className="min-h-[320px] p-5">
          {tab === "saved" &&
            (savedCars.length === 0 ? (
              <Empty>No saved cars yet. Tap the heart on any vehicle to keep it here.</Empty>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {savedCars.map((c) => (
                  <div key={c.id} className="overflow-hidden rounded-2xl bg-white/[.04]">
                    <img src={c.image} alt={c.name} loading="lazy" className="h-36 w-full object-cover" />
                    <div className="p-4">
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-xs text-white/40">${c.price.toLocaleString()} · {c.hp} HP</p>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => { onBook(c.id); }} className="flex-1 rounded-xl bg-crimson py-2 text-xs font-bold">Book test drive</button>
                        <button onClick={() => onToggleSaved(c.id)} aria-label={`Remove ${c.name} from saved`} className="glass rounded-xl px-3"><Heart size={14} fill="currentColor" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {tab === "drives" &&
            (bookings === null ? <Empty>Loading…</Empty> : bookings.length === 0 ? (
              <Empty>No test drives yet. Book one from any vehicle and it will appear here.</Empty>
            ) : (
              <ul className="grid gap-3">
                {bookings.map((b) => (
                  <li key={b._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[.04] p-4">
                    <div>
                      <p className="font-semibold">{b.carName}</p>
                      <p className="text-xs text-white/45">{b.date} · {b.time} · {b.location}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Pill s={b.status} />
                      {(b.status === "pending" || b.status === "confirmed") && (
                        <button
                          onClick={async () => {
                            try { await api.patch(`/bookings/${b._id}/cancel`); notify("Test drive cancelled"); } catch (e) { notify(errorMessage(e)); }
                            loadBookings();
                          }}
                          className="text-xs text-white/50 underline hover:text-white"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ))}

          {tab === "requests" &&
            (inquiries === null ? <Empty>Loading…</Empty> : inquiries.length === 0 ? (
              <Empty>No requests yet. Finance quotes you send appear here.</Empty>
            ) : (
              <ul className="grid gap-3">
                {inquiries.map((i) => (
                  <li key={i._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[.04] p-4">
                    <div>
                      <p className="font-semibold">{i.type === "finance" ? "Finance quote" : "Inquiry"}{i.carName ? ` · ${i.carName}` : ""}</p>
                      <p className="text-xs text-white/45">
                        {i.finance ? `$${i.finance.monthly.toLocaleString()}/mo · $${i.finance.down.toLocaleString()} down · ${i.finance.rate}% · ${i.finance.years}y · ` : ""}
                        {new Date(i.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Pill s={i.status} />
                  </li>
                ))}
              </ul>
            ))}

          {tab === "profile" && (
            <div className="grid gap-6">
              {user.role === "admin" && (
                <a href="/admin" className="flex items-center gap-3 rounded-2xl bg-crimson p-4 font-bold"><Shield size={18} /> Open Admin Console</a>
              )}
              <form
                className="grid gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try { const r = await api.patch<{ user: typeof user }>("/auth/profile", { name }); setUser(r.user); notify("Profile updated"); } catch (err) { notify(errorMessage(err)); }
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[.2em] text-white/40">Profile</p>
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} aria-label="Full name" />
                <input className={`${input} opacity-50`} value={user.email} disabled aria-label="Email" />
                <button disabled={!name || name === user.name} className="w-fit rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black disabled:opacity-30">Save name</button>
              </form>
              <form
                className="grid gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try { await api.patch("/auth/password", { currentPassword: pw.cur, newPassword: pw.next }); setPw({ cur: "", next: "" }); notify("Password updated"); } catch (err) { notify(errorMessage(err)); }
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[.2em] text-white/40">Change password</p>
                <PasswordInput className={input} placeholder="Current password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />
                <PasswordInput className={input} placeholder="New password (10+ chars, upper, lower, number)" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                <button disabled={!pw.cur || !pw.next} className="w-fit rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black disabled:opacity-30">Update password</button>
              </form>
              <button
                onClick={async () => { await logout(); onLogout(); onClose(); notify("Signed out"); }}
                className="glass flex w-fit items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
