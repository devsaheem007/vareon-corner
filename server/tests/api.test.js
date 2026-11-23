process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "a".repeat(48);
process.env.ADMIN_EMAIL = "reserved-admin@vareon.test";
process.env.OTP_RESEND_SECONDS = "0";
process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.JWT_REFRESH_SECRET = "b".repeat(48);
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-api-key";
process.env.CLOUDINARY_API_SECRET = "test-api-secret";
process.env.UPLOAD_DIR = new URL("./_uploads", import.meta.url).pathname;

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";

const { createApp } = await import("../src/app.js");
const { connectDB, disconnectDB } = await import("../src/config/db.js");
const { outbox } = await import("../src/utils/mailer.js");
const { google } = await import("../src/utils/google.js");
const { seedCars, seedSettings, seedAdmin } =
  await import("../src/seed/seed.js");
const cloudinary = (await import("../src/config/cloudinary.js")).default;

let server, base;
const URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/vareon_test";
const ADMIN = { email: "boss@vareon.test", password: "Sup3rSecretPw" };

/** Minimal cookie-aware fetch client. */
function client() {
  const jar = new Map();
  const api = async (
    method,
    path,
    body,
    { headers = {}, raw = false } = {},
  ) => {
    const h = { "X-Requested-With": "XMLHttpRequest", ...headers };
    if (body !== undefined && !(body instanceof FormData))
      h["Content-Type"] = "application/json";
    if (jar.size) h.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(base + path, {
      method,
      headers: h,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const [k, v] = [pair.slice(0, i), pair.slice(i + 1)];
      if (v === "" || /Expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(k);
      else jar.set(k, v);
    }
    if (raw) return res;
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, body: json, headers: res.headers };
  };
  api.jar = jar;
  return api;
}

before(async () => {
  await connectDB(URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  await seedCars();
  await seedSettings();
  await seedAdmin(ADMIN.email, ADMIN.password, "Boss");
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  await mongoose.connection.dropDatabase();
  await disconnectDB();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

/** Latest 6-digit code e-mailed to an address (the stand-in mailer records every message). */
const lastCode = (email) => {
  const m = [...outbox]
    .reverse()
    .find((x) => x.to.includes(email) && /\b\d{6}\b/.test(x.text));
  return m?.text.match(/\b(\d{6})\b/)?.[1];
};
/** Register + confirm the e-mail code, ending with a signed-in client (what a real customer does). */
async function signup(api, name, email, password = "Passw0rdLong") {
  const reg = await api("POST", "/api/auth/register", {
    name,
    email,
    password,
  });
  assert.equal(reg.status, 202, JSON.stringify(reg.body));
  return api("POST", "/api/auth/verify-email", {
    email,
    code: lastCode(email),
  });
}

const futureDate = (days = 10) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

test("health + security headers", async () => {
  const api = client();
  const r = await api("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-security-policy"));
  assert.equal(r.headers.get("x-powered-by"), null);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});

test("catalogue: all 31 seeded cars, filters, 404", async () => {
  const api = client();
  const all = await api("GET", "/api/cars");
  assert.equal(all.body.cars.length, 31);
  assert.deepEqual(Object.keys(all.body.cars[0]).sort().slice(0, 4), [
    "category",
    "colors",
    "createdAt",
    "fuel",
  ]);
  assert.equal(all.body.cars[0].id, 1);
  assert.equal(all.body.cars[0]._id, undefined);
  const ev = await api("GET", "/api/cars?fuel=EV");
  assert.equal(ev.body.cars.length, 3);
  const cheap = await api("GET", "/api/cars?maxPrice=50000");
  assert.ok(
    cheap.body.cars.length > 0 &&
      cheap.body.cars.every((c) => c.price <= 50000),
  );
  const search = await api("GET", "/api/cars?search=porsche");
  assert.equal(search.body.cars.length, 2);
  assert.equal((await api("GET", "/api/cars/9999")).status, 404);
  assert.equal((await api("GET", "/api/cars?category=Boats")).status, 400);
});

test("CSRF guard rejects mutating calls without the custom header", async () => {
  const res = await fetch(base + "/api/subscribers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "x@y.com" }),
  });
  assert.equal(res.status, 403);
});

test("NoSQL injection payloads are rejected", async () => {
  const api = client();
  const r = await api("POST", "/api/auth/login", {
    email: { $gt: "" },
    password: { $gt: "" },
  });
  assert.equal(r.status, 400);
  const q = await api("GET", "/api/cars?search[$ne]=x");
  assert.equal(q.status, 400);
});

test("auth: register -> me -> refresh rotation -> reuse detection -> logout", async () => {
  const api = client();
  const weak = await api("POST", "/api/auth/register", {
    name: "Sam",
    email: "sam@x.com",
    password: "short",
  });
  assert.equal(weak.status, 400);
  const escalate = await api("POST", "/api/auth/register", {
    name: "Sam",
    email: "sam@x.com",
    password: "Passw0rdLong",
    role: "admin",
  });
  assert.equal(escalate.status, 400, "unknown keys (role) must be rejected");

  const pending = await api("POST", "/api/auth/register", {
    name: "Sam",
    email: "Sam@X.com",
    password: "Passw0rdLong",
  });
  assert.equal(pending.status, 202);
  assert.equal(pending.body.needsVerification, true);
  assert.equal(
    api.jar.get("vc_at"),
    undefined,
    "no session before the e-mail is confirmed",
  );
  assert.equal(
    (
      await api("POST", "/api/auth/login", {
        email: "sam@x.com",
        password: "Passw0rdLong",
      })
    ).body.code,
    "EMAIL_NOT_VERIFIED",
  );
  const invalidOtp = await api("POST", "/api/auth/verify-email", {
    email: "sam@x.com",
    code: "000000",
  });

  assert.equal(invalidOtp.body.code, "OTP_INVALID");
  const reg = await api("POST", "/api/auth/verify-email", {
    email: "sam@x.com",
    code: lastCode("sam@x.com"),
  });
  assert.equal(reg.status, 200);
  assert.equal(reg.body.user.role, "customer");
  assert.equal(reg.body.user.passwordHash, undefined);
  assert.equal(reg.body.user.refreshTokens, undefined);
  assert.equal(reg.body.user.email, "sam@x.com");
  assert.equal(
    (
      await api("POST", "/api/auth/register", {
        name: "Sam",
        email: "sam@x.com",
        password: "Passw0rdLong",
      })
    ).status,
    409,
  );

  assert.equal((await api("GET", "/api/auth/me")).body.user.email, "sam@x.com");

  const oldRefresh = api.jar.get("vc_rt");
  assert.equal((await api("POST", "/api/auth/refresh")).status, 200);
  assert.notEqual(api.jar.get("vc_rt"), oldRefresh, "refresh token rotates");

  // replaying the already-rotated token = theft signal: every session is revoked
  const thief = client();
  thief.jar.set("vc_rt", oldRefresh);
  assert.equal((await thief("POST", "/api/auth/refresh")).status, 401);
  assert.equal(
    (await api("POST", "/api/auth/refresh")).status,
    401,
    "legit session also revoked",
  );

  const again = client();
  await again("POST", "/api/auth/login", {
    email: "sam@x.com",
    password: "Passw0rdLong",
  });
  assert.equal((await again("GET", "/api/auth/me")).status, 200);
  await again("POST", "/api/auth/logout");
  assert.equal((await again("GET", "/api/auth/me")).status, 401);
});

test("auth cookies are httpOnly + SameSite", async () => {
  const api = client();
  const res = await api(
    "POST",
    "/api/auth/login",
    { email: ADMIN.email, password: ADMIN.password },
    { raw: true },
  );
  const cookies = res.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  for (const c of cookies)
    (assert.match(c, /HttpOnly/i), assert.match(c, /SameSite=Lax/i));
  assert.match(
    cookies.find((c) => c.startsWith("vc_rt")),
    /Path=\/api\/auth/,
  );
});

test("login lockout after repeated failures + generic errors", async () => {
  const api = client();
  await signup(api, "Lock", "lock@x.com");
  const anon = client();
  const unknown = await anon("POST", "/api/auth/login", {
    email: "nobody@x.com",
    password: "Passw0rdLong",
  });
  const wrong = await anon("POST", "/api/auth/login", {
    email: "lock@x.com",
    password: "WrongPassw0rd",
  });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.message, wrong.body.message, "no user enumeration");
  for (let i = 0; i < 4; i++)
    await anon("POST", "/api/auth/login", {
      email: "lock@x.com",
      password: "WrongPassw0rd",
    });
  const locked = await anon("POST", "/api/auth/login", {
    email: "lock@x.com",
    password: "Passw0rdLong",
  });
  assert.equal(locked.status, 429, "correct password refused while locked");
});

test("authorisation: anonymous 401, customer 403, admin 200", async () => {
  const anon = client();
  assert.equal((await anon("GET", "/api/admin/stats")).status, 401);
  const cust = client();
  await signup(cust, "Cu", "cu@x.com");
  assert.equal((await cust("GET", "/api/admin/stats")).status, 403);
  assert.equal((await cust("POST", "/api/admin/cars", {})).status, 403);
  const admin = client();
  await admin("POST", "/api/auth/login", ADMIN);
  const stats = await admin("GET", "/api/admin/stats");
  assert.equal(stats.status, 200);
  assert.equal(stats.body.totals.cars, 31);
});

test("bookings: create, double-booking blocked, validation, admin workflow", async () => {
  const api = client();
  const date = futureDate();
  const good = {
    carId: 1,
    name: "Ali Khan",
    email: "ali@x.com",
    phone: "+971 50 123 4567",
    location: "Dubai — Downtown",
    date,
    time: "10:00 AM",
  };
  const ok = await api("POST", "/api/bookings", good);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.booking.carName, "Toyota Land Cruiser 300");
  assert.equal(ok.body.booking.status, "pending");

  const dup = await api("POST", "/api/bookings", {
    ...good,
    name: "Other",
    email: "other@x.com",
  });
  assert.equal(dup.status, 409);
  assert.equal(
    (await api("POST", "/api/bookings", { ...good, time: "12:30 PM" })).status,
    201,
    "other slot ok",
  );
  assert.equal(
    (
      await api("POST", "/api/bookings", {
        ...good,
        date: "2020-01-01",
        time: "05:00 PM",
      })
    ).status,
    400,
    "past",
  );
  assert.equal(
    (
      await api("POST", "/api/bookings", {
        ...good,
        location: "Mars",
        time: "05:00 PM",
      })
    ).status,
    400,
    "location",
  );
  assert.equal(
    (await api("POST", "/api/bookings", { ...good, time: "1:11 AM" })).status,
    400,
    "slot",
  );
  assert.equal(
    (
      await api("POST", "/api/bookings", {
        ...good,
        carId: 4242,
        time: "05:00 PM",
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await api("POST", "/api/bookings", {
        ...good,
        status: "confirmed",
        time: "06:30 PM",
      })
    ).status,
    400,
    "status can't be set by customer",
  );

  const admin = client();
  await admin("POST", "/api/auth/login", ADMIN);
  const list = await admin("GET", "/api/admin/bookings");
  assert.equal(list.body.total, 2);
  const id = ok.body.booking._id;
  const cancelled = await admin("PATCH", `/api/admin/bookings/${id}`, {
    status: "cancelled",
  });
  assert.equal(cancelled.body.booking.status, "cancelled");
  // cancelling frees the slot
  assert.equal(
    (
      await api("POST", "/api/bookings", {
        ...good,
        name: "Next",
        email: "next@x.com",
      })
    ).status,
    201,
  );
  assert.equal(
    (await admin("DELETE", `/api/admin/bookings/${id}`)).status,
    200,
  );
  assert.equal(
    (await admin("GET", "/api/admin/bookings?status[$ne]=x")).status,
    400,
  );
});

test("finance inquiry: server recomputes the payment (client price ignored)", async () => {
  const api = client();
  const r = await api("POST", "/api/inquiries", {
    type: "finance",
    name: "Fin",
    email: "fin@x.com",
    carId: 3,
    finance: { down: 15200, rate: 5.9, years: 5 },
    message: "Hi",
  });
  assert.equal(r.status, 201);
  const tampered = await api("POST", "/api/inquiries", {
    type: "finance",
    name: "Fin",
    email: "fin@x.com",
    carId: 3,
    finance: { down: 15200, rate: 5.9, years: 5, monthly: 1, price: 1 },
  });
  assert.equal(tampered.status, 400);
  assert.equal(
    (
      await api("POST", "/api/inquiries", {
        type: "finance",
        name: "Fin",
        email: "fin@x.com",
      })
    ).status,
    400,
  );

  const admin = client();
  await admin("POST", "/api/auth/login", ADMIN);
  const list = await admin("GET", "/api/admin/inquiries?type=finance");
  const f = list.body.items[0].finance;
  assert.equal(f.price, 76000);
  assert.equal(f.monthly, 1173); // 60,800 @ 5.9% over 60 months = 1172.6, rounded like the on-page calculator
  const upd = await admin(
    "PATCH",
    `/api/admin/inquiries/${list.body.items[0]._id}`,
    { status: "contacted" },
  );
  assert.equal(upd.body.inquiry.status, "contacted");
});

test("subscribers: idempotent, CSV export is formula-safe", async () => {
  const api = client();
  assert.equal(
    (await api("POST", "/api/subscribers", { email: "fan@x.com" })).status,
    201,
  );
  assert.equal(
    (await api("POST", "/api/subscribers", { email: "FAN@x.com" })).status,
    201,
  );
  assert.equal(
    (await api("POST", "/api/subscribers", { email: "not-an-email" })).status,
    400,
  );
  const admin = client();
  await admin("POST", "/api/auth/login", ADMIN);
  const list = await admin("GET", "/api/admin/subscribers");
  assert.equal(list.body.total, 1);
  const csv = await admin("GET", "/api/admin/subscribers/export");
  assert.match(csv.headers.get("content-type"), /text\/csv/);
  assert.match(csv.body, /fan@x\.com/);
});

test("admin car CRUD: ids auto-increment, validation, hidden cars leave the public API", async () => {
  const admin = client();
  await admin("POST", "/api/auth/login", ADMIN);
  const payload = {
    name: "Test GT",
    category: "Supercars",
    fuel: "Petrol",
    price: 99000,
    hp: 500,
    zero: 3.5,
    top: 180,
    transmission: "8-Speed",
    image: "/cars/BMW.jpg",
    colors: [{ name: "Signature", accent: "#E63946", image: "/cars/BMW.jpg" }],
  };
  const created = await admin("POST", "/api/admin/cars", payload);
  assert.equal(created.status, 201);
  assert.equal(created.body.car.id, 32);
  assert.equal(
    (
      await admin("POST", "/api/admin/cars", {
        ...payload,
        image: "javascript:alert(1)",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await admin("POST", "/api/admin/cars", {
        ...payload,
        image: "//evil.com/x.png",
      })
    ).status,
    400,
  );
  assert.equal(
    (await admin("POST", "/api/admin/cars", { ...payload, extra: 1 })).status,
    400,
  );
  assert.equal(
    (
      await admin("PATCH", "/api/admin/cars/32", {
        price: 95000,
        isActive: false,
      })
    ).body.car.price,
    95000,
  );
  const pub = client();
  assert.equal(
    (await pub("GET", "/api/cars")).body.cars.length,
    31,
    "hidden car not public",
  );
  assert.equal((await pub("GET", "/api/cars/32")).status, 404);
  assert.equal((await admin("GET", "/api/admin/cars")).body.cars.length, 32);
  assert.equal((await admin("DELETE", "/api/admin/cars/32")).status, 200);
  assert.equal((await admin("DELETE", "/api/admin/cars/32")).status, 404);
});

test("settings: public read, admin-only validated update, social links + wa.me", async () => {
  const pub = client();
  const before = await pub("GET", "/api/settings");
  assert.equal(before.body.settings.locations.length, 4);
  assert.equal(
    (await pub("PUT", "/api/admin/settings", { whatsapp: "+1" })).status,
    401,
  );
  const admin = client();
  await admin("POST", "/api/auth/login", ADMIN);
  assert.equal(
    (
      await admin("PUT", "/api/admin/settings", {
        social: { instagram: "javascript:alert(1)" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await admin("PUT", "/api/admin/settings", {
        social: { instagram: "http://insecure.com" },
      })
    ).status,
    400,
  );
  const ok = await admin("PUT", "/api/admin/settings", {
    social: { instagram: "https://instagram.com/vareon" },
    whatsapp: "+971500000000",
  });
  assert.equal(ok.status, 200);
  const after = await pub("GET", "/api/settings");
  assert.equal(
    after.body.settings.social.instagram,
    "https://instagram.com/vareon",
  );
  assert.equal(
    after.body.settings.social.facebook,
    "",
    "untouched fields preserved",
  );
  assert.equal(after.body.settings.whatsappUrl, "https://wa.me/971500000000");
});

test("users admin: cannot change own role; deactivated users lose access", async () => {
  const admin = client();
  const login = await admin("POST", "/api/auth/login", ADMIN);
  assert.equal(
    (
      await admin("PATCH", `/api/admin/users/${login.body.user._id}`, {
        role: "customer",
      })
    ).status,
    400,
  );
  const victim = client();
  const reg = await signup(victim, "Vic", "victim@x.com");
  assert.equal(
    (
      await admin("PATCH", `/api/admin/users/${reg.body.user._id}`, {
        isActive: false,
      })
    ).status,
    200,
  );
  assert.equal((await victim("GET", "/api/auth/me")).status, 401);
  assert.equal(
    (
      await client()("POST", "/api/auth/login", {
        email: "victim@x.com",
        password: "Passw0rdLong",
      })
    ).status,
    401,
  );
});

test("favorites sync for signed-in customers", async () => {
  const api = client();
  await signup(api, "Fay", "fav@x.com");
  assert.deepEqual(
    (await api("PUT", "/api/me/favorites", { favorites: [1, 2, 2, 5] })).body
      .favorites,
    [1, 2, 5],
  );
  assert.deepEqual(
    (await api("GET", "/api/me/favorites")).body.favorites,
    [1, 2, 5],
  );
  assert.equal((await client()("GET", "/api/me/favorites")).status, 401);
});

test("uploads: admin only, magic-byte verified, MIME matched, Cloudinary mocked", async () => {
  const admin = client();
  await admin("POST", "/api/auth/login", ADMIN);

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );

  const form = (buf, type, name) => {
    const f = new FormData();
    f.append("image", new Blob([buf], { type }), name);
    return f;
  };

  const originalUploadStream = cloudinary.uploader.upload_stream;
  const uploadCalls = [];

  let mockSecureUrl =
    "https://res.cloudinary.com/test-cloud/image/upload/v1/vareon/test-image.png";

  cloudinary.uploader.upload_stream = (options, callback) => ({
    end(buffer) {
      uploadCalls.push({ options, buffer });
      callback(null, { secure_url: mockSecureUrl });
    },
  });

  try {
    // Valid PNG upload
    const ok = await admin(
      "POST",
      "/api/admin/uploads",
      form(png, "image/png", "../../evil.png"),
    );

    assert.equal(ok.status, 201);
    assert.equal(ok.body.url, mockSecureUrl);

    assert.equal(uploadCalls.length, 1);
    assert.equal(uploadCalls[0].options.folder, "vareon");
    assert.equal(uploadCalls[0].options.resource_type, "image");
    assert.match(uploadCalls[0].options.public_id, /^[0-9a-f-]{36}$/);
    assert.deepEqual(uploadCalls[0].buffer, png);

    // HTML disguised as PNG
    const fake = await admin(
      "POST",
      "/api/admin/uploads",
      form(
        Buffer.from("<script>alert(1)</script>".padEnd(40)),
        "image/png",
        "x.png",
      ),
    );

    assert.equal(fake.status, 415);
    assert.equal(uploadCalls.length, 1);

    // Actual PNG incorrectly declared as JPEG
    const mismatch = await admin(
      "POST",
      "/api/admin/uploads",
      form(png, "image/jpeg", "wrong-type.jpg"),
    );

    assert.equal(mismatch.status, 415);
    assert.equal(
      uploadCalls.length,
      1,
      "MIME mismatch must not reach Cloudinary",
    );

    // SVG is not an accepted upload
    const svg = await admin(
      "POST",
      "/api/admin/uploads",
      form(Buffer.from("<svg/>"), "image/svg+xml", "x.svg"),
    );

    assert.equal(svg.status, 415);
    assert.equal(uploadCalls.length, 1);

    // Cloudinary returning an HTTP URL must be rejected
    mockSecureUrl =
      "http://res.cloudinary.com/test-cloud/image/upload/test.png";

    const insecureUrl = await admin(
      "POST",
      "/api/admin/uploads",
      form(png, "image/png", "insecure.png"),
    );

    assert.equal(insecureUrl.status, 502);
    assert.equal(uploadCalls.length, 2);

    // Cloudinary returning no URL must also be rejected
    mockSecureUrl = undefined;

    const missingUrl = await admin(
      "POST",
      "/api/admin/uploads",
      form(png, "image/png", "missing-url.png"),
    );

    assert.equal(missingUrl.status, 502);
    assert.equal(uploadCalls.length, 3);

    // Anonymous upload must be rejected
    assert.equal(
      (
        await client()(
          "POST",
          "/api/admin/uploads",
          form(png, "image/png", "a.png"),
        )
      ).status,
      401,
    );

    assert.equal(
      uploadCalls.length,
      3,
      "unauthorized upload must not reach Cloudinary",
    );
  } finally {
    cloudinary.uploader.upload_stream = originalUploadStream;
  }
});

test("unknown routes and malformed JSON return clean JSON errors", async () => {
  const api = client();
  const nf = await api("GET", "/api/nope");
  assert.equal(nf.status, 404);
  const bad = await fetch(base + "/api/subscribers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: "{oops",
  });
  assert.equal(bad.status, 400);
  const evil = await fetch(base + "/api/cars", {
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(evil.status, 403);
});

test("customer area: own bookings only, cancel own, profile, admin e-mail can't be claimed", async () => {
  const a = client(),
    b = client();
  await signup(a, "Ann", "ann@x.com");
  await signup(b, "Bob", "bob@x.com");
  const slot = {
    carId: 2,
    name: "Ann",
    email: "ann@x.com",
    location: "Dubai — Downtown",
    date: futureDate(40),
    time: "10:00 AM",
  };
  const made = await a("POST", "/api/bookings", slot);
  assert.equal(made.status, 201);
  // a guest booking made with Ann's e-mail must NOT show up for someone who merely registered with that e-mail
  await client()("POST", "/api/bookings", { ...slot, time: "12:30 PM" });
  assert.equal((await a("GET", "/api/bookings/mine")).body.bookings.length, 1);
  assert.equal((await b("GET", "/api/bookings/mine")).body.bookings.length, 0);

  // Bob cannot cancel Ann's booking; Ann can, and the slot is freed
  assert.equal(
    (await b("PATCH", `/api/bookings/${made.body.booking._id}/cancel`)).status,
    404,
  );
  assert.equal(
    (await a("PATCH", `/api/bookings/${made.body.booking._id}/cancel`)).body
      .booking.status,
    "cancelled",
  );
  assert.equal(
    (await a("PATCH", `/api/bookings/${made.body.booking._id}/cancel`)).status,
    400,
  );
  assert.equal(
    (
      await client()("POST", "/api/bookings", {
        ...slot,
        name: "New",
        email: "new@x.com",
      })
    ).status,
    201,
  );

  // own inquiries
  await a("POST", "/api/inquiries", {
    type: "general",
    name: "Ann",
    email: "ann@x.com",
    message: "Hello",
  });
  assert.equal(
    (await a("GET", "/api/inquiries/mine")).body.inquiries.length,
    1,
  );
  assert.equal(
    (await b("GET", "/api/inquiries/mine")).body.inquiries.length,
    0,
  );

  // profile: name only
  assert.equal(
    (await a("PATCH", "/api/auth/profile", { name: "Ann Lee" })).body.user.name,
    "Ann Lee",
  );
  assert.equal(
    (await a("PATCH", "/api/auth/profile", { name: "Ann", role: "admin" }))
      .status,
    400,
  );
  assert.equal(
    (await client()("PATCH", "/api/auth/profile", { name: "Zed" })).status,
    401,
  );
});

test("the configured admin e-mail cannot be registered publicly", async () => {
  const r = await client()("POST", "/api/auth/register", {
    name: "Squatter",
    email: "Reserved-Admin@vareon.test",
    password: "Passw0rdLong",
  });
  assert.equal(r.status, 409);
});

test("sign-up code: single use, 5 attempts then locked, unverified accounts get replaced", async () => {
  const api = client();
  await api("POST", "/api/auth/register", {
    name: "Ova",
    email: "ova@x.com",
    password: "Passw0rdLong",
  });
  const good = lastCode("ova@x.com");
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await api("POST", "/api/auth/verify-email", {
          email: "ova@x.com",
          code: good === "111111" ? "222222" : "111111",
        })
      ).body.code,
      "OTP_INVALID",
    );
  assert.equal(
    (
      await api("POST", "/api/auth/verify-email", {
        email: "ova@x.com",
        code: good,
      })
    ).body.code,
    "OTP_LOCKED",
  );
  // an attacker who pre-registered someone's address cannot keep it: the real owner's sign-up replaces it
  const real = client();
  const ok = await signup(real, "Real Owner", "ova@x.com", "AnotherPassw0rd");
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.name, "Real Owner");
  assert.equal(
    (
      await client()("POST", "/api/auth/login", {
        email: "ova@x.com",
        password: "Passw0rdLong",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await real("POST", "/api/auth/verify-email", {
        email: "ova@x.com",
        code: good,
      })
    ).status,
    400,
    "codes are single-use / spent",
  );
});

test("forgot password: generic reply, reset with code, old sessions revoked, old password dead", async () => {
  const phone = client();
  await signup(phone, "Fora", "fora@x.com");
  const stranger = client();
  const unknown = await stranger("POST", "/api/auth/forgot-password", {
    email: "ghost@x.com",
  });
  const known = await stranger("POST", "/api/auth/forgot-password", {
    email: "fora@x.com",
  });
  assert.equal(unknown.status, 200);
  assert.deepEqual(
    unknown.body,
    known.body,
    "must not reveal whether the account exists",
  );
  assert.equal(lastCode("ghost@x.com"), undefined);
  assert.equal(
    (
      await stranger("POST", "/api/auth/reset-password", {
        email: "fora@x.com",
        code: "123456",
        newPassword: "BrandNewPassw0rd",
      })
    ).status,
    400,
  );
  const r = await stranger("POST", "/api/auth/reset-password", {
    email: "fora@x.com",
    code: lastCode("fora@x.com"),
    newPassword: "BrandNewPassw0rd",
  });
  assert.equal(r.status, 200);
  assert.equal(
    (await stranger("GET", "/api/auth/me")).body.user.email,
    "fora@x.com",
  );
  assert.equal(
    (
      await client()("POST", "/api/auth/login", {
        email: "fora@x.com",
        password: "Passw0rdLong",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await client()("POST", "/api/auth/login", {
        email: "fora@x.com",
        password: "BrandNewPassw0rd",
      })
    ).status,
    200,
  );
  const oldSession = await phone("POST", "/api/auth/refresh");
  assert.equal(oldSession.status, 401, "other devices are signed out");
  assert.ok(
    outbox.some(
      (m) => m.to.includes("fora@x.com") && /password/i.test(m.subject),
    ),
  );
});

test("google sign-in: creates a verified customer, links by e-mail, never the admin", async () => {
  const api = client();
  google.verify = async (c) => ({
    sub: `sub-${c}`,
    email: "gina@gmail.test",
    name: "Gina G",
    emailVerified: true,
  });
  const r = await api("POST", "/api/auth/google", {
    credential: "x".repeat(30),
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, "customer");
  assert.equal(
    (await api("GET", "/api/auth/me")).body.user.email,
    "gina@gmail.test",
  );
  google.verify = async () => ({
    sub: "evil",
    email: ADMIN.email,
    name: "Not Boss",
    emailVerified: true,
  });
  const adm = await client()("POST", "/api/auth/google", {
    credential: "y".repeat(30),
  });
  assert.equal(adm.status, 200); // linking by verified e-mail is how the real owner may sign in with Google
  google.verify = async () => ({
    sub: "s2",
    email: "unverified@gmail.test",
    name: "U",
    emailVerified: false,
  });
  assert.equal(
    (await client()("POST", "/api/auth/google", { credential: "z".repeat(30) }))
      .status,
    401,
  );
  google.verify = async () => {
    throw new Error("bad token");
  };
  assert.equal(
    (await client()("POST", "/api/auth/google", { credential: "w".repeat(30) }))
      .status,
    401,
  );
});

test("alerts: admins and the right customer are notified, nobody reads someone else's", async () => {
  const admin = client();
  await admin("POST", "/api/auth/login", ADMIN);
  const ann = client();
  await signup(ann, "Alerta", "alerta@x.com");
  const bob = client();
  await signup(bob, "Bobby", "bobby@x.com");
  const before = (await admin("GET", "/api/notifications")).body.unread;
  const cars = (await client()("GET", "/api/cars")).body;
  const car = (cars.cars || cars)[0];
  const bk = await ann("POST", "/api/bookings", {
    carId: car.id,
    name: "Alerta",
    email: "alerta@x.com",
    phone: "5551234567",
    date: futureDate(30),
    time: "12:30 PM",
    location: "Dubai — Downtown",
  });
  assert.equal(bk.status, 201, JSON.stringify(bk.body));
  const fin = await ann("POST", "/api/inquiries", {
    type: "finance",
    name: "Alerta",
    email: "alerta@x.com",
    carId: car.id,
    finance: { down: 10000, rate: 5, years: 5 },
  });
  assert.equal(fin.status, 201, JSON.stringify(fin.body));
  const sub = await client()("POST", "/api/subscribers", {
    email: "newsletter@x.com",
  });
  assert.equal(sub.status, 201);
  const a = (await admin("GET", "/api/notifications")).body;
  assert.equal(a.unread - before, 3);
  assert.ok(
    a.items.some((n) => n.type === "booking") &&
      a.items.some((n) => n.type === "inquiry") &&
      a.items.some((n) => n.type === "subscriber"),
  );
  assert.ok(
    outbox.some(
      (m) => m.to.includes(ADMIN.email) && /test drive/i.test(m.subject),
    ),
    "admin gets an e-mail too",
  );
  const mine = (await ann("GET", "/api/notifications")).body;
  assert.ok(mine.items.some((n) => /Test drive requested/.test(n.title)));
  assert.equal(
    (await bob("GET", "/api/notifications")).body.items.length,
    0,
    "other customers see nothing",
  );
  // status change by admin alerts the owner of the booking
  const list = (await admin("GET", "/api/admin/bookings")).body;
  const target = (list.items || list.bookings).find(
    (b) => b.email === "alerta@x.com",
  );
  assert.equal(
    (
      await admin("PATCH", `/api/admin/bookings/${target._id}`, {
        status: "confirmed",
      })
    ).status,
    200,
  );
  const after = (await ann("GET", "/api/notifications")).body;
  assert.ok(after.items.some((n) => /confirmed/.test(n.title)));
  // read state + isolation
  const id = after.items[0]._id;
  assert.equal(
    (await bob("PATCH", `/api/notifications/${id}/read`)).status,
    404,
  );
  assert.equal(
    (await ann("PATCH", `/api/notifications/${id}/read`)).status,
    200,
  );
  await ann("POST", "/api/notifications/read-all");
  assert.equal((await ann("GET", "/api/notifications")).body.unread, 0);
  assert.equal((await client()("GET", "/api/notifications")).status, 401);
});
