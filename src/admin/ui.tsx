import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import type { Paged } from "./types";

/* ---------- toast ---------- */
const ToastCtx = createContext<(m: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const timer = useRef<number>(0);
  const notify = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(""), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={notify}>
      {children}
      <AnimatePresence>
        {msg && (
          <motion.div
            role="status"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-white/10 bg-[#161616]/95 px-5 py-3 text-sm shadow-2xl backdrop-blur-xl"
          >
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-crimson">
              <Check size={13} />
            </span>
            {msg}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastCtx.Provider>
  );
}

/* ---------- primitives ---------- */
export const inputCls =
  "w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none transition focus:border-crimson";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[9px] font-bold uppercase tracking-[.2em] text-white/40">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-white/30">{hint}</span>}
    </label>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" };
export function Btn({ variant = "primary", className = "", ...p }: BtnProps) {
  const v = {
    primary: "bg-crimson text-white shadow-crimson hover:scale-[1.03]",
    ghost: "glass text-white/80 hover:bg-white/10",
    danger: "border border-crimson/40 text-crimson hover:bg-crimson/10",
  }[variant];
  return (
    <button
      {...p}
      className={`rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition disabled:pointer-events-none disabled:opacity-30 ${v} ${className}`}
    />
  );
}

const TONES: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-300",
  confirmed: "bg-emerald-400/10 text-emerald-300",
  completed: "bg-sky-400/10 text-sky-300",
  cancelled: "bg-white/5 text-white/40",
  new: "bg-crimson/15 text-crimson",
  contacted: "bg-amber-400/10 text-amber-300",
  closed: "bg-white/5 text-white/40",
  finance: "bg-sky-400/10 text-sky-300",
  general: "bg-white/5 text-white/50",
  admin: "bg-crimson/15 text-crimson",
  customer: "bg-white/5 text-white/50",
  live: "bg-emerald-400/10 text-emerald-300",
  hidden: "bg-white/5 text-white/40",
};
export const Badge = ({ children }: { children: string }) => (
  <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${TONES[children] ?? "bg-white/5 text-white/50"}`}>
    {children}
  </span>
);

export function Card({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-3xl p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h3 className="font-display text-lg font-bold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Modal({ title, eyebrow, onClose, children, wide = false }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-md sm:items-center"
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
        className={`my-6 w-full ${wide ? "max-w-3xl" : "max-w-lg"} overflow-hidden rounded-3xl border border-white/10 bg-[#141414] shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-white/8 p-5">
          <div>
            {eyebrow && <p className="text-[9px] uppercase tracking-[.25em] text-crimson">{eyebrow}</p>}
            <h3 className="font-display text-xl font-bold">{title}</h3>
          </div>
          <button onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </motion.div>
  );
}

export function Confirm({ text, confirmLabel = "Delete", onConfirm, onClose }: { text: string; confirmLabel?: string; onConfirm: () => void | Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Are you sure?" onClose={onClose}>
      <p className="text-sm text-white/60">{text}</p>
      <div className="mt-6 flex gap-2">
        <Btn variant="ghost" className="flex-1" onClick={onClose}>Cancel</Btn>
        <Btn
          variant="primary"
          className="flex-1"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Btn>
      </div>
    </Modal>
  );
}

export function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-white/40">
      <span>{total} total</span>
      <div className="flex items-center gap-2">
        <Btn variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Btn>
        <span>{page} / {pages}</span>
        <Btn variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Btn>
      </div>
    </div>
  );
}

export const Table = ({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[720px] text-left text-sm">
      <thead>
        <tr>{head.map((h) => <th key={h} className="p-3 text-[10px] font-bold uppercase tracking-[.2em] text-white/30">{h}</th>)}</tr>
      </thead>
      <tbody className="[&>tr]:border-t [&>tr]:border-white/8 [&>tr>td]:p-3 [&>tr>td]:align-top">{children}</tbody>
    </table>
    {empty && <p className="py-12 text-center text-sm text-white/40">{empty}</p>}
  </div>
);

/* ---------- data hooks ---------- */
export function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Fetches a paged admin list; ignores out-of-order responses. */
export function useList<T>(path: string, params: Record<string, string | number | undefined>) {
  const notify = useToast();
  const [data, setData] = useState<Paged<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]),
  ).toString();
  const reload = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const r = await api.get<Paged<T>>(`${path}?${qs}`);
      if (mine === seq.current) setData(r);
    } catch (e) {
      if (mine === seq.current) notify(errorMessage(e));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [path, qs, notify]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, reload };
}

export const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "-");
export const fmtMoney = (n: number) => `$${n.toLocaleString()}`;
