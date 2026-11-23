import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CalendarClock, CheckCheck, CircleDollarSign, Mail, UserPlus, Info } from "lucide-react";
import { api } from "../lib/api";

export type AppNotification = {
  _id: string;
  type: "booking" | "inquiry" | "account" | "subscriber" | "system";
  title: string;
  body: string;
  link: string;
  readAt: string | null;
  createdAt: string;
};

const ICON = { booking: CalendarClock, inquiry: CircleDollarSign, subscriber: Mail, account: UserPlus, system: Info };
const POLL_MS = 20_000;

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/**
 * Alert bell for customers and staff. Polls the API (cheap, no websockets to keep alive), shows a red badge,
 * pops a toast for anything new, and opens a list where each alert deep-links to the right screen.
 */
export default function NotificationBell({
  onOpenLink,
  notify,
  className = "",
  align = "right",
}: {
  onOpenLink: (link: string) => void;
  notify?: (m: string) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const seen = useRef<Set<string> | null>(null); // null until the first load, so old alerts never toast
  const box = useRef<HTMLDivElement>(null);
  const toast = useRef(notify);
  toast.current = notify;

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ items: AppNotification[]; unread: number }>("/notifications");
      if (seen.current) {
        const fresh = r.items.filter((n) => !n.readAt && !seen.current!.has(n._id));
        if (fresh.length) toast.current?.(fresh.length === 1 ? `🔔 ${fresh[0].title}` : `🔔 ${fresh.length} new alerts`);
      }
      seen.current = new Set(r.items.map((n) => n._id));
      setItems(r.items);
      setUnread(r.unread);
    } catch {
      /* offline or signed out: try again next tick */
    }
  }, []);

  useEffect(() => {
    void load();
    const tick = () => document.visibilityState === "visible" && void load();
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const click = (n: AppNotification) => {
    setOpen(false);
    if (!n.readAt) {
      setItems((l) => l.map((x) => (x._id === n._id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
      void api.patch(`/notifications/${n._id}/read`).catch(() => {});
    }
    if (n.link) onOpenLink(n.link);
  };
  const readAll = () => {
    setItems((l) => l.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    setUnread(0);
    void api.post("/notifications/read-all").catch(() => {});
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Alerts, ${unread} unread` : "Alerts"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-crimson px-1 text-[10px] font-bold leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            role="dialog"
            aria-label="Alerts"
            className={`absolute top-12 z-[95] w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#141414] text-white shadow-2xl ${align === "right" ? "right-0" : "left-0"}`}
          >
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-white/60">Alerts</p>
              {unread > 0 && (
                <button onClick={readAll} className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white">
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[22rem] overflow-y-auto overscroll-contain">
              {items.length === 0 && <p className="px-4 py-10 text-center text-xs text-white/40">You&apos;re all caught up.</p>}
              {items.map((n) => {
                const I = ICON[n.type] ?? Info;
                return (
                  <button key={n._id} onClick={() => click(n)} className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 ${n.readAt ? "opacity-55" : ""}`}>
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.readAt ? "bg-white/8" : "bg-crimson/20 text-crimson"}`}>
                      <I size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-white/50">{n.body}</span>}
                      <span className="mt-0.5 block text-[10px] text-white/30">{ago(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-crimson" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
