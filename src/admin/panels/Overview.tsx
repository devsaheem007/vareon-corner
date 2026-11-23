import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { Badge, Card, fmtDate, fmtMoney, useToast } from "../ui";
import type { Stats } from "../types";

const STATUS_ORDER = ["pending", "confirmed", "completed", "cancelled"];

export default function Overview({ go }: { go: (t: "cars" | "bookings" | "inquiries" | "subscribers" | "users") => void }) {
  const notify = useToast();
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    api.get<Stats>("/admin/stats").then(setS).catch((e) => notify(errorMessage(e)));
  }, [notify]);
  if (!s) return <p className="text-sm text-white/40">Loading…</p>;

  const tiles: { label: string; value: number; sub: string; to: "cars" | "bookings" | "inquiries" | "subscribers" | "users" }[] = [
    { label: "Vehicles live", value: s.totals.activeCars, sub: `${s.totals.cars} in total`, to: "cars" },
    { label: "Upcoming drives", value: s.totals.upcomingBookings, sub: "pending + confirmed", to: "bookings" },
    { label: "New inquiries", value: s.totals.newInquiries, sub: "awaiting a reply", to: "inquiries" },
    { label: "Subscribers", value: s.totals.subscribers, sub: "private updates list", to: "subscribers" },
    { label: "Accounts", value: s.totals.users, sub: "staff + customers", to: "users" },
  ];
  const totalBookings = Object.values(s.bookingsByStatus).reduce((a, b) => a + b, 0) || 1;

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.3em] text-crimson">Overview</p>
      <h1 className="font-display text-4xl font-bold">Today in the showroom</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map((t) => (
          <button key={t.label} onClick={() => go(t.to)} className="glass rounded-3xl p-5 text-left transition hover:bg-white/10">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/40">{t.label}</p>
            <p className="mt-3 font-display text-4xl font-bold">{t.value}</p>
            <p className="mt-1 text-xs text-white/35">{t.sub}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card title="Test drives by status">
          <div className="grid gap-3">
            {STATUS_ORDER.map((st) => {
              const n = s.bookingsByStatus[st] ?? 0;
              return (
                <div key={st}>
                  <div className="mb-1 flex justify-between text-xs"><Badge>{st}</Badge><b>{n}</b></div>
                  <div className="h-1.5 rounded-full bg-white/8"><div className="h-full rounded-full bg-crimson" style={{ width: `${(n / totalBookings) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Fleet by category">
          <div className="grid gap-2 text-sm">
            {Object.entries(s.carsByCategory).map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-xl bg-white/[.035] px-4 py-3"><span className="text-white/60">{k}</span><b>{v}</b></div>
            ))}
          </div>
        </Card>
        <Card title="Latest test drives">
          {s.recentBookings.length === 0 ? <p className="text-sm text-white/40">Nothing yet.</p> : (
            <ul className="grid gap-3">
              {s.recentBookings.map((b) => (
                <li key={b._id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0"><p className="truncate font-semibold">{b.name} · {b.carName}</p><p className="text-xs text-white/40">{b.date} · {b.time} · {b.location}</p></div>
                  <Badge>{b.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Latest inquiries">
          {s.recentInquiries.length === 0 ? <p className="text-sm text-white/40">Nothing yet.</p> : (
            <ul className="grid gap-3">
              {s.recentInquiries.map((i) => (
                <li key={i._id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0"><p className="truncate font-semibold">{i.name}{i.carName ? ` · ${i.carName}` : ""}</p><p className="text-xs text-white/40">{i.finance ? `${fmtMoney(i.finance.monthly)}/mo · ` : ""}{fmtDate(i.createdAt)}</p></div>
                  <Badge>{i.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
