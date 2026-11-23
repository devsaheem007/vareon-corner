# The Vareon Corner — MERN showroom

React (Vite + Tailwind) frontend · Node/Express API · MongoDB (Mongoose). The public UI is unchanged; everything dynamic now flows through the API.

## One site, one sign-in
Everyone signs in from the showroom's **Sign in** button.
- The **admin e-mail** (`ADMIN_EMAIL`, created by `npm run seed`) goes straight to the admin console at `/admin`.
- **Any other e-mail** can register and gets a personal panel: saved cars (synced to the account), test drives (with cancel), finance requests, profile and password.
- The admin e-mail can never be registered publicly, and customers get `403` on every `/api/admin/*` route. Only an admin can promote another account (Admin → Accounts).

## Quick start
```bash
npm run install:all                 # frontend + server deps
cp server/.env.example server/.env  # then fill JWT secrets + ADMIN_EMAIL / ADMIN_PASSWORD
npm run seed                        # 31 cars, site settings, first admin
npm run dev:all                     # site on :5173 (proxies /api), API on :5000
```
Staff console: **http://localhost:5173/admin** (sign in with ADMIN_EMAIL / ADMIN_PASSWORD).

Generate secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` (run twice; they must differ).

## Sign-up codes, password reset, Google and alerts

- **Register** -> the server e-mails a 6-digit code (valid 10 min, 5 tries, single use). The account only becomes active when the code is confirmed, so fake e-mail addresses can't sign up.
- **Forgot password** (sign-in form, or the link on the admin login) -> code by e-mail -> choose a new password. Every other device is signed out and a "password changed" e-mail is sent.
- **Continue with Google** appears automatically once `GOOGLE_CLIENT_ID` is set (see `server/.env.example`). Google has already verified the address, so no code is needed.
- **Alerts**: the bell in the site header (customers) and in the console (admin) shows new test drives, finance/contact requests, subscribers and new accounts, and status changes of your own bookings and requests. Each alert is also e-mailed. Alerts refresh every 20 seconds.
- **No SMTP yet?** In development the e-mails (with the codes) are printed in the terminal running the server. In production SMTP is required.
- **Admin e-mail**: the admin is created by `npm run seed`. If someone had registered that address before, the seed takes the account over with *your* `ADMIN_PASSWORD`.

## Production
```bash
npm run build      # builds the site into dist/
NODE_ENV=production npm start   # Express serves the API *and* dist/ from one origin
```
Set `NODE_ENV=production`, `MONGODB_URI` (Atlas), both JWT secrets, `CLIENT_URL` (your https origin), `TRUST_PROXY=1` behind nginx/Render/Railway. Serve over HTTPS (cookies are `Secure` in production). Persist `server/uploads/` (or set `UPLOAD_DIR`) on a volume.

## What's where
| Area | Location |
|---|---|
| Public site | `src/App.tsx` (+ `src/components`, `src/lib`) |
| Built-in fallback catalogue | `src/data/cars.ts` |
| Staff console | `src/admin/*` (lazy-loaded at `/admin`) |
| API | `server/src` (`routes → validators → controllers → models`) |
| Tests | `server/tests/api.test.js` (`npm test`, needs a MongoDB at `TEST_MONGODB_URI`) |
| Brand assets | `public/brand/` (round logo, favicons, share image) |

## API summary
Public: `GET /api/cars`, `GET /api/settings`, `POST /api/bookings`, `POST /api/inquiries`, `POST /api/subscribers`, `POST /api/auth/{register,login,refresh,logout}`, `GET /api/auth/me`, `GET|PUT /api/me/favorites`, `GET /api/bookings/mine`.
Admin (role `admin`): everything under `/api/admin/*` — stats, cars CRUD, bookings, inquiries, subscribers (+CSV), users, settings, image uploads.

## Security model
- bcrypt (12 rounds), password policy, 5-strike account lockout, uniform login errors (no user enumeration)
- JWT access (15 min) + rotating refresh (7 d) in `httpOnly`, `SameSite=Lax`, `Secure` (prod) cookies; refresh reuse revokes all sessions; passwords/tokens never in JSON
- Role never accepted from client input; admin routes behind `requireAdmin`; deactivated users lose access immediately
- zod strict validation on every endpoint, NoSQL-operator stripping, regex escaping, server-side recomputation of finance figures
- helmet + CSP, strict CORS allow-list, CSRF header guard, rate limits (global / auth / forms), 50 KB body cap
- uploads: type verified by magic bytes, random filenames, 5 MB cap, no SVG
- double-booking prevented by a unique slot index

## Social media
Admin → Settings: WhatsApp number (click-to-chat), Instagram, Facebook, YouTube, TikTok, X, LinkedIn. Icons appear in the footer only when a link is set. `index.html` carries Open Graph / Twitter-card tags and AutoDealer JSON-LD using the round logo (`public/brand/og-image.jpg`). Set your real domain in the `og:image` URLs (they must be absolute for some crawlers).
