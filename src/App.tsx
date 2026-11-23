import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  GitCompareArrows,
  Heart,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  X,
  Zap,
} from "lucide-react";

import type { Car, Category, Fuel } from "./lib/types";
import { cars as fallbackCars } from "./data/cars";
import { api, errorMessage } from "./lib/api";
import { useShowroomData } from "./lib/useShowroomData";
import type { SiteSettings } from "./lib/types";
import RoundLogo from "./components/RoundLogo";
import SocialLinks from "./components/SocialLinks";
import SplashScreen from "./components/SplashScreen";
import AuthModal from "./components/AuthModal";
import NotificationBell from "./components/NotificationBell";
import AccountPanel, { type AccountTab } from "./components/AccountPanel";
import { useAuth, type User } from "./lib/auth";

const fallbackCarImage = (name: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#161616"/><stop offset="1" stop-color="#2a080b"/></linearGradient></defs><rect width="1200" height="700" fill="url(#g)"/><path d="M180 470h90l80-120h390l115 120h95v55H180z" fill="#090909" stroke="#b91c2a" stroke-width="5"/><circle cx="350" cy="525" r="55" fill="#090909" stroke="#777" stroke-width="12"/><circle cx="850" cy="525" r="55" fill="#090909" stroke="#777" stroke-width="12"/><text x="600" y="110" text-anchor="middle" fill="#fff" font-family="Arial" font-size="34" letter-spacing="6">VAREON MOTORS</text><text x="600" y="650" text-anchor="middle" fill="#fff" font-family="Arial" font-size="24">${name.replace("&", "&amp;")}</text></svg>`)}`;

function CarImage({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? fallbackCarImage(alt) : src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

type FinanceDraft = { down: number; rate: number; years: number; monthly: number };

function App() {
  // Live catalogue + site settings from the API (built-in data is the instant first paint / offline fallback).
  const { cars, settings, loaded } = useShowroomData();
  const [category, setCategory] = useState<Category>("All");
  const [fuel, setFuel] = useState<Fuel>("All");
  const [maxPrice, setMaxPrice] = useState(350000);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<number[]>([]);
  const [compare, setCompare] = useState<number[]>([]);
  const [activeId, setActiveId] = useState<number>(fallbackCars[0].id);
  const activeCar: Car = cars.find((c) => c.id === activeId) ?? cars[0] ?? fallbackCars[0];
  const [bookingOpen, setBookingOpen] = useState(false);
  const [quote, setQuote] = useState<FinanceDraft | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [toast, setToast] = useState("");
  const [slide, setSlide] = useState(0);
  const { user, logout } = useAuth();
  const [authReason, setAuthReason] = useState<string | null>(null); // non-null = sign-in modal open
  // "/?forgot=1" (linked from the admin sign-in) opens the modal straight on "Forgot password".
  const [startForgot] = useState(() => new URLSearchParams(window.location.search).has("forgot"));
  useEffect(() => {
    if (!startForgot) return;
    setAuthReason("");
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }, [startForgot]);
  const [accountTab, setAccountTab] = useState<AccountTab | null>(null); // non-null = account panel open

  // Saved cars: kept locally for guests, synced to the account once signed in.
  const syncedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user) {
      syncedFor.current = null;
      return;
    }
    syncedFor.current = user._id;
    setSaved((local) => [...new Set([...user.favorites, ...local])]); // merge what they saved as a guest
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);
  useEffect(() => {
    if (!user || syncedFor.current !== user._id) return;
    const t = window.setTimeout(() => {
      api.put("/me/favorites", { favorites: saved }).catch(() => {});
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, user?._id]);

  const openAccount = (tab: AccountTab = "saved") => {
    if (user) setAccountTab(tab);
    else setAuthReason("");
  };

  const filtered = useMemo(
    () =>
      cars.filter(
        (c) =>
          (category === "All" || c.category === category) &&
          (fuel === "All" || c.fuel === fuel) &&
          c.price <= maxPrice &&
          c.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [cars, category, fuel, maxPrice, search],
  );

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const toggleSaved = (id: number) => {
    setSaved((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
    notify(
      saved.includes(id) ? "Removed from saved cars" : "Saved to your garage",
    );
  };

  const toggleCompare = (id: number) => {
    setCompare((v) => {
      if (v.includes(id)) return v.filter((x) => x !== id);
      if (v.length >= 3) {
        notify("You can compare up to 3 models");
        return v;
      }
      return [...v, id];
    });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0D0D0D] text-white">
      <SplashScreen ready={loaded} />
      <Navbar
        user={user}
        onAccount={() => openAccount("saved")}
        onSaved={() =>
          user ? setAccountTab("saved") : setAuthReason("Sign in to see your saved cars and keep them on every device.")
        }
        savedCount={saved.length}
        compareCount={compare.length}
        onBooking={() => setBookingOpen(true)}
        onCompare={() => setCompareOpen(true)}
        notify={notify}
        onAlertLink={(link) => {
          if (link.startsWith("account:")) setAccountTab(link.slice(8) as AccountTab);
          else if (link.startsWith("/admin")) window.location.assign(link);
        }}
      />
      <main>
        <Hero
          car={activeCar}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
          onBook={() => setBookingOpen(true)}
        />
        <section
          id="inventory"
          className="relative px-4 py-24 sm:px-6 lg:px-10"
        >
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="THE COLLECTION"
              title="Featured Fleet"
              text="Curated machines engineered for people who refuse ordinary."
            />
            <div className="mt-10 grid gap-4 lg:grid-cols-[250px_1fr]">
              <FilterPanel
                category={category}
                setCategory={setCategory}
                fuel={fuel}
                setFuel={setFuel}
                maxPrice={maxPrice}
                setMaxPrice={setMaxPrice}
                search={search}
                setSearch={setSearch}
              />
              <div>
                <div className="mb-5 flex items-center justify-between text-sm text-white/50">
                  <span>{filtered.length} vehicles available</span>
                  {compare.length > 0 && (
                    <button
                      onClick={() => setCompareOpen(true)}
                      className="text-crimson hover:text-white transition"
                    >
                      Compare {compare.length}
                    </button>
                  )}
                </div>
                <motion.div
                  layout
                  className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
                >
                  <AnimatePresence mode="popLayout">
                    {filtered.map((car) => (
                      <VehicleCard
                        key={car.id}
                        car={car}
                        saved={saved.includes(car.id)}
                        comparing={compare.includes(car.id)}
                        onSave={() => toggleSaved(car.id)}
                        onCompare={() => toggleCompare(car.id)}
                        onConfigure={() => {
                          setActiveId(car.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
                {filtered.length === 0 && (
                  <div className="glass mt-5 rounded-3xl p-12 text-center text-white/60">
                    No vehicles match those filters.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <Visualizer
          car={activeCar}
          setCar={(c) => setActiveId(c.id)}
          onBook={() => setBookingOpen(true)}
        />

        <section
          id="finance"
          className="grid-bg relative px-4 py-24 sm:px-6 lg:px-10"
        >
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="PRIVATE FINANCE"
              title="Make the numbers perform."
              text="Model a payment plan in seconds with live calculations."
            />
            <FinanceCalculator price={activeCar.price} onQuote={setQuote} />
          </div>
        </section>

        <Experience />
        <Testimonials slide={slide} setSlide={setSlide} />
      </main>
      <Footer notify={notify} settings={settings} />
      <AnimatePresence>
        {bookingOpen && (
          <BookingModal
            car={activeCar}
            user={user}
            locations={settings.locations}
            onClose={() => setBookingOpen(false)}
            notify={notify}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {authReason !== null && (
          <AuthModal
            reason={authReason || undefined}
            onClose={() => setAuthReason(null)}
            notify={notify}
            googleClientId={settings.googleClientId}
            startView={startForgot ? "forgot" : "in"}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {accountTab && user && (
          <AccountPanel
            tab={accountTab}
            cars={cars}
            saved={saved}
            onToggleSaved={toggleSaved}
            onBook={(id) => {
              setActiveId(id);
              setAccountTab(null);
              setBookingOpen(true);
            }}
            onClose={() => setAccountTab(null)}
            onLogout={() => setSaved([])}
            notify={notify}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {quote && (
          <FinanceQuoteModal
            car={activeCar}
            user={user}
            draft={quote}
            onClose={() => setQuote(null)}
            notify={notify}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {compareOpen && (
          <CompareDrawer
            cars={cars}
            ids={compare}
            onClose={() => setCompareOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-white/10 bg-[#161616]/95 px-5 py-3 text-sm shadow-2xl backdrop-blur-xl"
          >
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-crimson">
              <Check size={13} />
            </span>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Navbar({
  user,
  onAccount,
  onSaved,
  savedCount,
  compareCount,
  onBooking,
  onCompare,
  onAlertLink,
  notify,
}: {
  onAlertLink: (link: string) => void;
  notify: (m: string) => void;
  user: User | null;
  onAccount: () => void;
  onSaved: () => void;
  savedCount: number;
  compareCount: number;
  onBooking: () => void;
  onCompare: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-3 pt-3 sm:px-6">
      <nav className="glass mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-4 py-3 shadow-2xl shadow-black/30">
        <a href="#" className="flex shrink-0 items-center" aria-label="Vareon Motors home">
          <RoundLogo size={48} priority className="h-11 w-11 sm:h-12 sm:w-12" />
        </a>
        <div className="hidden items-center gap-7 text-xs font-semibold uppercase tracking-[.14em] text-white/60 md:flex">
          <a href="#inventory" className="hover:text-white">
            Inventory
          </a>
          <a href="#finance" className="hover:text-white">
            Finance
          </a>
          <button onClick={onCompare} className="relative hover:text-white">
            Compare
            {compareCount > 0 && (
              <b className="absolute -right-4 -top-3 rounded-full bg-crimson px-1.5 text-[9px] text-white">
                {compareCount}
              </b>
            )}
          </button>
          <button onClick={onSaved} className="relative hover:text-white">
            Saved
            {savedCount > 0 && (
              <b className="absolute -right-4 -top-3 rounded-full bg-white px-1.5 text-[9px] text-black">
                {savedCount}
              </b>
            )}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {user && <NotificationBell onOpenLink={onAlertLink} notify={notify} />}
          <button
            onClick={onAccount}
            aria-label={user ? "Your account" : "Sign in"}
            className={
              user
                ? "flex h-10 w-10 items-center justify-center rounded-full bg-white/10 font-display text-sm font-bold hover:bg-white/20"
                : "glass rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-white/10"
            }
          >
            {user ? user.name.charAt(0).toUpperCase() : "Sign in"}
          </button>
          <button
            onClick={onBooking}
            className="hidden rounded-xl bg-crimson px-4 py-2.5 text-xs font-bold uppercase tracking-wider shadow-crimson transition hover:scale-[1.03] md:block"
          >
            Book Test Drive
          </button>
          <button onClick={() => setOpen((v) => !v)} className="md:hidden">
            <Menu />
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass mx-3 mt-2 rounded-2xl p-4 md:hidden"
          >
            <div className="grid gap-3 text-sm">
              <a href="#inventory" onClick={() => setOpen(false)}>
                Inventory
              </a>
              <a href="#finance" onClick={() => setOpen(false)}>
                Finance
              </a>
              <button className="text-left" onClick={onCompare}>
                Compare ({compareCount})
              </button>
              <button className="text-left" onClick={onSaved}>
                Saved ({savedCount})
              </button>
              <button
                onClick={onBooking}
                className="rounded-xl bg-crimson px-4 py-3 text-left font-bold"
              >
                Book Test Drive
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function Hero({
  car,
  soundOn,
  setSoundOn,
  onBook,
}: {
  car: Car;
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
  onBook: () => void;
}) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 650], [0, 110]);
  return (
    <section className="relative min-h-[760px] overflow-hidden px-4 pb-20 pt-32 sm:px-6 lg:px-10">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <motion.div
        style={{ y }}
        className="absolute -right-40 top-28 h-[420px] w-[420px] rounded-full bg-crimson/10 blur-[110px]"
      />
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[.85fr_1.4fr]">
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -25 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.32em] text-crimson"
          >
            <span className="h-px w-10 bg-crimson" />
            EST. 1998 · PRIVATE MOTORS
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display text-5xl font-bold leading-[.92] sm:text-7xl xl:text-8xl"
          >
            UNLEASH
            <br />
            <span className="chrome-text">PURE</span>
            <br />
            <span className="text-crimson">PERFORMANCE.</span>
          </motion.h1>
          <p className="mt-7 max-w-md text-sm leading-7 text-white/50">
            A private collection of extraordinary machines. Precision
            engineered, personally curated, relentlessly fast.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={onBook}
              className="group inline-flex items-center gap-3 rounded-xl bg-crimson px-5 py-3.5 text-sm font-bold shadow-crimson transition hover:scale-[1.03]"
            >
              Book a Test Drive{" "}
              <ArrowRight
                size={16}
                className="transition group-hover:translate-x-1"
              />
            </button>
            <button
              onClick={() => setSoundOn(!soundOn)}
              className="glass inline-flex items-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold hover:bg-white/10"
            >
              <span
                className={`h-2 w-2 rounded-full ${soundOn ? "bg-crimson animate-pulse" : "bg-white/30"}`}
              />
              {soundOn ? "ENGINE LIVE" : "ENGINE SOUND"}
            </button>
          </div>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
            <Stat value={String(car.hp)} suffix=" HP" />
            <Stat value={car.zero.toFixed(1)} suffix=" SEC" />
            <Stat value={String(car.top)} suffix=" MPH" />
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7 }}
          className="relative min-h-[390px]"
        >
          <div className="absolute inset-x-10 bottom-6 h-16 rounded-full bg-crimson/25 blur-3xl" />
          <motion.div
            key={car.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative z-10"
          >
            <CarImage
              src={car.image}
              alt={car.name}
              eager
              className="h-[390px] w-full rounded-[2rem] object-cover shadow-2xl grayscale-[15%]"
            />
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-t from-black/70 via-transparent to-black/5" />
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[.25em] text-white/50">
                  Spotlight
                </p>
                <h2 className="font-display text-3xl font-bold">{car.name}</h2>
              </div>
              <div className="glass rounded-xl px-3 py-2 text-right">
                <p className="text-[9px] uppercase text-white/50">From</p>
                <b>${car.price.toLocaleString()}</b>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ value, suffix }: { value: string; suffix: string }) {
  return (
    <div className="glass rounded-2xl p-3">
      <b className="font-display text-xl">{value}</b>
      <span className="text-[9px] font-bold text-white/40">{suffix}</span>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="max-w-2xl">
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[.3em] text-crimson">
        {eyebrow}
      </div>
      <h2 className="font-display text-4xl font-bold sm:text-5xl">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-white/45">{text}</p>
    </div>
  );
}

function FilterPanel({
  category,
  setCategory,
  fuel,
  setFuel,
  maxPrice,
  setMaxPrice,
  search,
  setSearch,
}: {
  category: Category;
  setCategory: (v: Category) => void;
  fuel: Fuel;
  setFuel: (v: Fuel) => void;
  maxPrice: number;
  setMaxPrice: (v: number) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  return (
    <aside className="glass h-fit rounded-3xl p-4 lg:sticky lg:top-24">
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-3.5 text-white/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search models..."
          className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-9 pr-3 text-sm outline-none focus:border-crimson"
        />
      </div>
      <p className="mb-2 text-[9px] font-bold uppercase tracking-[.2em] text-white/35">
        Category
      </p>
      <div className="mb-5 grid gap-1">
        {(
          [
            "All",
            "Supercars",
            "SUVs",
            "Electric",
            "Luxury Sedans",
          ] as Category[]
        ).map((x) => (
          <button
            key={x}
            onClick={() => setCategory(x)}
            className={`rounded-lg px-3 py-2 text-left text-xs ${category === x ? "bg-white text-black font-bold" : "text-white/50 hover:bg-white/5"}`}
          >
            {x}
          </button>
        ))}
      </div>
      <p className="mb-2 text-[9px] font-bold uppercase tracking-[.2em] text-white/35">
        Fuel
      </p>
      <div className="mb-5 flex flex-wrap gap-1">
        {(["All", "EV", "Hybrid", "Petrol"] as Fuel[]).map((x) => (
          <button
            key={x}
            onClick={() => setFuel(x)}
            className={`rounded-lg px-3 py-2 text-xs ${fuel === x ? "bg-crimson text-white" : "bg-white/5 text-white/50"}`}
          >
            {x}
          </button>
        ))}
      </div>
      <div>
        <div className="mb-2 flex justify-between text-[9px] font-bold uppercase tracking-[.2em] text-white/35">
          <span>Max Price</span>
          <span className="text-white">${Math.round(maxPrice / 1000)}k</span>
        </div>
        <input
          type="range"
          min="100000"
          max="350000"
          step="5000"
          value={maxPrice}
          onChange={(e) => setMaxPrice(+e.target.value)}
          className="w-full accent-[#E63946]"
        />
      </div>
    </aside>
  );
}

function VehicleCard({
  car,
  saved,
  comparing,
  onSave,
  onCompare,
  onConfigure,
}: {
  car: Car;
  saved: boolean;
  comparing: boolean;
  onSave: () => void;
  onCompare: () => void;
  onConfigure: () => void;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="group overflow-hidden rounded-3xl border border-white/8 bg-[#121212]"
    >
      <div className="relative h-52 overflow-hidden">
        <CarImage
          src={car.image}
          alt={car.name}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-black/20" />
        <button
          onClick={onSave}
          className={`absolute right-3 top-3 rounded-full p-2 transition-colors ${saved ? "bg-crimson text-white" : "bg-black/35 text-white/60"}`}
        >
          <Heart size={15} fill={saved ? "currentColor" : "none"} />
        </button>
        <span className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest">
          {car.category}
        </span>
      </div>
      <div className="p-4">
        <div className="flex justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold">{car.name}</h3>
            <p className="mt-1 text-xs text-white/40">
              {car.fuel} · {car.transmission}
            </p>
          </div>
          <b className="text-sm">${car.price.toLocaleString()}</b>
        </div>
        <div className="my-4 grid grid-cols-3 gap-2">
          {[
            [car.hp + " HP", "Power"],
            [car.zero + "s", "0-60"],
            [car.top + " MPH", "Top"],
          ].map(([a, b]) => (
            <div key={b} className="rounded-xl bg-white/[.035] p-2">
              <b className="block text-sm">{a}</b>
              <span className="text-[9px] text-white/30">{b}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onConfigure}
            className="flex-1 rounded-xl bg-white py-3 text-xs font-bold text-black transition hover:bg-crimson hover:text-white"
          >
            Configure
          </button>
          <button
            onClick={onCompare}
            className={`rounded-xl border px-3 ${comparing ? "border-crimson bg-crimson/10 text-crimson" : "border-white/10 text-white/50"}`}
          >
            <GitCompareArrows size={16} />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function Visualizer({
  car,
  setCar,
  onBook,
}: {
  car: Car;
  setCar: (c: Car) => void;
  onBook: () => void;
}) {
  // Keep the chosen finish by name so switching vehicles always shows the new vehicle's image.
  const [colorName, setColorName] = useState(car.colors[0]?.name);
  const color = car.colors.find((c) => c.name === colorName) ?? car.colors[0];
  const setColor = (c: Car["colors"][number]) => setColorName(c.name);
  return (
    <section className="border-y border-white/5 bg-[#101010] px-4 py-24 sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <SectionIntro
            eyebrow="CONFIGURATION STUDIO"
            title="Your spec. Your statement."
            text="Switch the finish and build a machine that feels unmistakably yours."
          />
          <div className="mt-8 flex gap-3">
            {car.colors.map((c) => (
              <button
                key={c.name}
                onClick={() => setColor(c)}
                className={`group flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${color.name === c.name ? "border-white/40 bg-white/10" : "border-white/10 bg-white/[.02]"}`}
              >
                <span
                  style={{ background: c.accent }}
                  className="h-5 w-5 rounded-full border border-white/20"
                />
                {c.name}
              </button>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={onBook}
              className="rounded-xl bg-crimson px-5 py-3 text-sm font-bold"
            >
              Reserve {car.name}
            </button>
            <a
              href="#finance"
              className="glass rounded-xl px-5 py-3 text-sm font-semibold"
            >
              Estimate Finance
            </a>
          </div>
        </div>
        <motion.div
          key={color.name + car.id}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-[2rem] border border-white/10"
        >
          <CarImage
            src={color.image}
            alt={car.name}
            className="h-[360px] w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-5 left-5">
            <p className="text-[9px] uppercase tracking-[.25em] text-white/45">
              Selected finish
            </p>
            <h3 className="font-display text-2xl font-bold">
              {color.name} {car.name}
            </h3>
          </div>
          <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-[10px]">
            <Sparkles size={12} className="text-crimson" /> Live Config
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FinanceCalculator({
  price,
  onQuote,
}: {
  price: number;
  onQuote: (d: FinanceDraft) => void;
}) {
  const [down, setDown] = useState(Math.round(price * 0.2));
  const [rate, setRate] = useState(5.9);
  const [years, setYears] = useState(5);
  const principal = Math.max(0, price - down),
    monthlyRate = rate / 100 / 12,
    months = years * 12;
  const payment =
    monthlyRate === 0
      ? principal / months
      : (principal * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
        (Math.pow(1 + monthlyRate, months) - 1);
  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="glass rounded-[2rem] p-6 sm:p-8">
        <div className="grid gap-7">
          <Slider
            label="Down payment"
            value={down}
            min={0}
            max={Math.round(price * 0.7)}
            step={1000}
            display={`$${down.toLocaleString()}`}
            onChange={setDown}
          />
          <Slider
            label="Interest rate"
            value={rate}
            min={1}
            max={12}
            step={0.1}
            display={`${rate.toFixed(1)}%`}
            onChange={setRate}
          />
          <Slider
            label="Loan duration"
            value={years}
            min={2}
            max={8}
            step={1}
            display={`${years} years`}
            onChange={setYears}
          />
        </div>
      </div>
      <div className="rounded-[2rem] bg-crimson p-7 text-white shadow-crimson">
        <CircleDollarSign size={25} />
        <p className="mt-10 text-xs uppercase tracking-[.2em] text-white/60">
          Estimated monthly
        </p>
        <div className="mt-2 font-display text-5xl font-bold">
          ${Math.round(payment).toLocaleString()}
        </div>
        <p className="mt-3 text-xs leading-5 text-white/65">
          Based on ${price.toLocaleString()} vehicle price. Taxes, fees and
          final lender terms may vary.
        </p>
        <button
          onClick={() =>
            onQuote({ down, rate, years, monthly: Math.round(payment) })
          }
          className="mt-7 w-full rounded-xl bg-black/25 py-3 text-sm font-bold hover:bg-black/40"
        >
          Request a Finance Quote
        </button>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex justify-between text-sm">
        <span className="text-white/60">{label}</span>
        <b>{display}</b>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full accent-[#E63946]"
      />
    </div>
  );
}

function Experience() {
  const items = [
    {
      icon: Zap,
      title: "Performance Lab",
      text: "Private tuning, detailing and bespoke aero programs.",
      num: "01",
    },
    {
      icon: ShieldCheck,
      title: "Concierge Care",
      text: "Door-to-door servicing and priority ownership support.",
      num: "02",
    },
    {
      icon: Trophy,
      title: "VIP Access",
      text: "Closed-track previews, launches and collector events.",
      num: "03",
    },
  ];
  return (
    <section className="px-4 py-24 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="THE VAREON EXPERIENCE"
          title="More than a showroom."
          text="A private automotive club built around the complete ownership experience."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {items.map((x, i) => {
            const I = x.icon;
            return (
              <motion.div
                whileHover={{ y: -6 }}
                key={x.title}
                className="glass rounded-[2rem] p-7"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-crimson/10 p-3 text-crimson">
                    <I size={22} />
                  </div>
                  <span className="font-display text-5xl font-bold text-white/5">
                    {x.num}
                  </span>
                </div>
                <h3 className="mt-12 font-display text-2xl font-bold">
                  {x.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/40">{x.text}</p>
                <button className="mt-7 inline-flex items-center gap-2 text-xs font-bold text-white/60 hover:text-white">
                  Discover <ArrowRight size={13} />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const reviews = [
  [
    "“The entire process felt like a private aviation experience — effortless, discreet and incredibly precise.”",
    "Marcus R.",
    "Dubai",
  ],
  [
    "“Vareon Motors found a specification I couldn't find anywhere else. The delivery was flawless.”",
    "Daniel K.",
    "Doha",
  ],
  [
    "“The track session changed what I thought a showroom could be.”",
    "Aisha M.",
    "Abu Dhabi",
  ],
];

function Testimonials({
  slide,
  setSlide,
}: {
  slide: number;
  setSlide: (n: number) => void;
}) {
  const r = reviews[slide];
  return (
    <section className="border-t border-white/5 bg-[#101010] px-4 py-24 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-4 flex justify-center gap-1 text-crimson">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={14} fill="currentColor" />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <blockquote className="font-display text-3xl font-medium leading-tight sm:text-5xl">
              {r[0]}
            </blockquote>
            <p className="mt-8 text-sm font-bold">
              {r[1]} <span className="text-white/30">· {r[2]}</span>
            </p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-10 flex justify-center gap-2">
          <button
            onClick={() =>
              setSlide((slide + reviews.length - 1) % reviews.length)
            }
            className="rounded-full border border-white/10 p-3"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setSlide((slide + 1) % reviews.length)}
            className="rounded-full border border-white/10 p-3"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function BookingModal({
  car,
  user,
  locations,
  onClose,
  notify,
}: {
  car: Car;
  user: User | null;
  locations: string[];
  onClose: () => void;
  notify: (m: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: "",
    location: locations[0],
    date: "",
    time: "10:00 AM",
  });
  const update = (k: string, v: string) => setForm({ ...form, [k]: v });
  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/bookings", {
        carId: car.id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        location: form.location,
        date: form.date,
        time: form.time,
      });
      onClose();
      notify(`Test drive booked for ${car.name}`);
    } catch (e) {
      // e.g. slot already taken: show why and send the guest back to pick another time
      notify(errorMessage(e));
      setBusy(false);
      setStep(2);
    }
  };
  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-3 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#141414] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/8 p-5">
          <div>
            <p className="text-[9px] uppercase tracking-[.25em] text-crimson">
              Private appointment
            </p>
            <h3 className="font-display text-xl font-bold">
              Book a Test Drive
            </h3>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="p-5">
          <div className="mb-7 flex gap-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-1 flex-1 rounded-full ${n <= step ? "bg-crimson" : "bg-white/10"}`}
              />
            ))}
          </div>
          {step === 1 && (
            <div>
              <label className="text-xs text-white/50">Vehicle</label>
              <select
                value={car.id}
                disabled
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
              >
                <option>
                  {car.name} — ${car.price.toLocaleString()}
                </option>
              </select>
              <label className="mt-5 block text-xs text-white/50">
                Preferred dealership
              </label>
              <select
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#181818] p-3 text-sm"
              >
                {locations.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <button
                onClick={() => setStep(2)}
                className="mt-6 w-full rounded-xl bg-crimson py-3 font-bold"
              >
                Continue
              </button>
            </div>
          )}
          {step === 2 && (
            <div>
              <label className="text-xs text-white/50">Date</label>
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={form.date}
                onChange={(e) => update("date", e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
              />
              <label className="mt-5 block text-xs text-white/50">
                Time slot
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  "10:00 AM",
                  "12:30 PM",
                  "03:30 PM",
                  "05:00 PM",
                  "06:30 PM",
                  "08:00 PM",
                ].map((t) => (
                  <button
                    key={t}
                    onClick={() => update("time", t)}
                    className={`rounded-xl border p-3 text-xs ${form.time === t ? "border-crimson bg-crimson/10 text-crimson" : "border-white/10"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="glass flex-1 rounded-xl py-3"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!form.date}
                  className="flex-1 rounded-xl bg-crimson py-3 font-bold disabled:opacity-30"
                >
                  Continue
                </button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <div className="rounded-2xl bg-white/[.03] p-4 text-sm">
                <p className="text-white/40">Appointment</p>
                <b>{car.name}</b>
                <p className="mt-1 text-white/60">
                  {form.location} · {form.date || "Select date"} · {form.time}
                </p>
              </div>
              <div className="mt-4 grid gap-3">
                <input
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none"
                />
                <input
                  placeholder="Email address"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none"
                />
                <input
                  placeholder="Phone number"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none"
                />
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="glass flex-1 rounded-xl py-3"
                >
                  Back
                </button>
                <button
                  onClick={submit}
                  disabled={!form.name || !form.email || busy}
                  className="flex-1 rounded-xl bg-crimson py-3 font-bold disabled:opacity-30"
                >
                  Confirm Drive
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function FinanceQuoteModal({
  car,
  user,
  draft,
  onClose,
  notify,
}: {
  car: Car;
  user: User | null;
  draft: FinanceDraft;
  onClose: () => void;
  notify: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: user?.name ?? "", email: user?.email ?? "", phone: "", message: "" });
  const update = (k: string, v: string) => setForm({ ...form, [k]: v });
  const field =
    "rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none";
  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/inquiries", {
        type: "finance",
        carId: car.id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: form.message,
        finance: { down: draft.down, rate: draft.rate, years: draft.years },
      });
      onClose();
      notify(`Finance quote requested for ${car.name}`);
    } catch (e) {
      notify(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-3 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#141414] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/8 p-5">
          <div>
            <p className="text-[9px] uppercase tracking-[.25em] text-crimson">
              Private finance
            </p>
            <h3 className="font-display text-xl font-bold">
              Request a Finance Quote
            </h3>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="p-5">
          <div className="rounded-2xl bg-white/[.03] p-4 text-sm">
            <p className="text-white/40">Your scenario</p>
            <b>{car.name}</b>
            <p className="mt-1 text-white/60">
              ${draft.monthly.toLocaleString()}/mo · ${draft.down.toLocaleString()}{" "}
              down · {draft.rate.toFixed(1)}% · {draft.years} years
            </p>
          </div>
          <div className="mt-4 grid gap-3">
            <input
              placeholder="Full name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={field}
            />
            <input
              placeholder="Email address"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className={field}
            />
            <input
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className={field}
            />
            <textarea
              placeholder="Anything we should know? (optional)"
              rows={3}
              maxLength={1000}
              value={form.message}
              onChange={(e) => update("message", e.target.value)}
              className={field}
            />
          </div>
          <div className="mt-6 flex gap-2">
            <button onClick={onClose} className="glass flex-1 rounded-xl py-3">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!form.name || !form.email || busy}
              className="flex-1 rounded-xl bg-crimson py-3 font-bold disabled:opacity-30"
            >
              Send Request
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CompareDrawer({
  cars,
  ids,
  onClose,
}: {
  cars: Car[];
  ids: number[];
  onClose: () => void;
}) {
  const selected = cars.filter((c) => ids.includes(c.id));
  const rows: [string, (c: Car) => ReactNode][] = [
    ["Price", (c) => <>${c.price.toLocaleString()}</>],
    ["Horsepower", (c) => <>{c.hp} HP</>],
    ["0-60 mph", (c) => <>{c.zero}s</>],
    ["Top speed", (c) => <>{c.top} MPH</>],
    ["Fuel", (c) => <>{c.fuel}</>],
    ["Transmission", (c) => <>{c.transmission}</>],
  ];
  return (
    <motion.div
      className="fixed inset-0 z-[75] bg-black/70"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="ml-auto h-full w-full max-w-4xl overflow-y-auto border-l border-white/10 bg-[#111] p-5 sm:p-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[.25em] text-crimson">
              Side-by-side
            </p>
            <h3 className="font-display text-3xl font-bold">Compare models</h3>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        {selected.length === 0 ? (
          <div className="py-20 text-center text-white/40">
            Select up to three vehicles from the fleet.
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr>
                  <th className="p-4 text-white/30">SPEC</th>
                  {selected.map((c) => (
                    <th key={c.id} className="p-4 font-display text-xl">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, render]) => (
                  <tr key={label} className="border-t border-white/8">
                    <td className="p-4 text-white/35">{label}</td>
                    {selected.map((c) => (
                      <td key={c.id} className="p-4 font-semibold">
                        {render(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.aside>
    </motion.div>
  );
}

function Footer({
  notify,
  settings,
}: {
  notify: (m: string) => void;
  settings: SiteSettings;
}) {
  const [email, setEmail] = useState("");
  const join = async () => {
    if (!email) return;
    try {
      const r = await api.post<{ message: string }>("/subscribers", { email });
      setEmail("");
      notify(r.message || "You're on the Vareon Motors list");
    } catch (e) {
      notify(errorMessage(e));
    }
  };
  return (
    <footer className="border-t border-white/5 px-4 py-14 sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.1fr_.6fr_.8fr]">
        <div>
          <div className="flex items-center">
            <RoundLogo size={56} className="h-14 w-14" />
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/35">
            Performance without compromise. A private automotive destination for
            collectors, drivers and those who demand more.
          </p>
          <div className="mt-6 flex gap-3">
            <SocialLinks settings={settings} />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest">Explore</p>
          <div className="mt-5 grid gap-3 text-sm text-white/40">
            <a href="#inventory">Inventory</a>
            <a href="#finance">Finance</a>
            <a href="#">Concierge</a>
            <a href="#">VIP Portal</a>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest">
            Private updates
          </p>
          <p className="mt-4 text-sm text-white/40">
            New arrivals, track events and private previews.
          </p>
          <div className="mt-4 flex rounded-xl border border-white/10 bg-white/[.03] p-1">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
            />
            <button
              onClick={join}
              className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-black"
            >
              Join
            </button>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-7xl border-t border-white/5 pt-5 text-[10px] text-white/25">
        © 2026 VAREON MOTORS. Crafted for the extraordinary.
      </div>
    </footer>
  );
}

export default App;
