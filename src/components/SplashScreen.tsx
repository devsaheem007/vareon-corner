import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import RoundLogo from "./RoundLogo";

const KEY = "vareon-splash-seen";
const MIN_MS = 1100; // long enough to read as a deliberate brand moment, short enough not to annoy
const MAX_MS = 4500; // never hold the visitor hostage to a slow API

const seen = () => {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** Brand loader: round logo with a crimson ring. Pure CSS animation (smooth on every device) and a tiny pre-sized logo. */
export function BrandLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center">
      <span className="sr-only">{label}</span>
      <div className="relative h-44 w-44">
        <div className="vc-glow absolute -inset-6 rounded-full" />
        <svg viewBox="0 0 100 100" className="vc-ring absolute inset-0 h-full w-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="0.8" />
          <circle cx="50" cy="50" r="48" fill="none" stroke="#E63946" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="90 211.6" />
        </svg>
        <div className="absolute inset-3">
          <RoundLogo size={152} priority className="h-full w-full shadow-2xl shadow-black" />
        </div>
      </div>
    </div>
  );
}

export default function SplashScreen({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(() => !seen());
  const [minDone, setMinDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const a = window.setTimeout(() => setMinDone(true), MIN_MS);
    const b = window.setTimeout(() => setTimedOut(true), MAX_MS);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [visible]);

  useEffect(() => {
    if (visible && minDone && (ready || timedOut)) {
      setVisible(false);
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {
        /* private mode: splash simply shows again next visit */
      }
    }
  }, [visible, minDone, ready, timedOut]);

  // keep the page from scrolling underneath the overlay
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-ink"
        >
          <div className="grid-bg absolute inset-0 opacity-40" />
          <div className="relative">
            <BrandLoader label="Loading Vareon Motors" />
          </div>
          <p className="relative mt-8 text-[10px] font-bold uppercase tracking-[.4em] text-white/40">Private Motors</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
