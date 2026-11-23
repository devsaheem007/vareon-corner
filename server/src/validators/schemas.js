import { z } from "zod";
import {
  BOOKING_STATUSES,
  CATEGORIES,
  FUELS,
  INQUIRY_STATUSES,
  INQUIRY_TYPES,
  ROLES,
  TIME_SLOTS,
} from "../config/constants.js";

/* ---------- primitives ---------- */
const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const personName = z.string().trim().min(2, "Name is too short").max(80);
const phone = z.string().trim().regex(/^[0-9+()\-\s]{6,25}$/, "Enter a valid phone number");
const optionalPhone = z.union([phone, z.literal("")]).optional();
export const password = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128)
  .regex(/[a-z]/, "Password needs a lowercase letter")
  .regex(/[A-Z]/, "Password needs an uppercase letter")
  .regex(/[0-9]/, "Password needs a number");
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const carIdNum = z.coerce.number().int().positive();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((d) => !Number.isNaN(Date.parse(d)), "Invalid date");

const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => {
    try {
      return new URL(v).protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be a valid https:// URL");
const optionalUrl = z.union([httpsUrl, z.literal("")]);

// Image reference: a site-relative path (/cars/x.jpg, /uploads/x.png) or an https URL.
const imageRef = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => (/^\/(?!\/)[\w\-. %()/]+$/.test(v) && !v.includes("..")) || /^https:\/\/[^\s"'<>]+$/.test(v),
    "Image must be a /path or an https:// URL",
  );

export const idParam = z.object({ id: carIdNum });
export const objectIdParam = z.object({ id: objectId });

/* ---------- auth ---------- */
export const registerBody = z.object({ name: personName, email, password }).strict();
export const loginBody = z.object({ email, password: z.string().min(1).max(128) }).strict();
const otpCode = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");
export const verifyEmailBody = z.object({ email, code: otpCode }).strict();
export const emailOnlyBody = z.object({ email }).strict();
export const resetPasswordBody = z.object({ email, code: otpCode, newPassword: password }).strict();
export const googleBody = z.object({ credential: z.string().min(20).max(4096) }).strict();
export const changePasswordBody = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
  .strict();
export const profileBody = z.object({ name: personName }).strict();
export const favoritesBody = z.object({ favorites: z.array(carIdNum).max(200) }).strict();

/* ---------- cars ---------- */
const colorSchema = z
  .object({ name: z.string().trim().min(1).max(40), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), image: imageRef })
  .strict();

const carBase = {
  name: z.string().trim().min(2).max(80),
  category: z.enum(CATEGORIES),
  fuel: z.enum(FUELS),
  price: z.coerce.number().int().min(0).max(100_000_000),
  hp: z.coerce.number().int().min(0).max(5000),
  zero: z.coerce.number().min(0).max(30),
  top: z.coerce.number().int().min(0).max(500),
  transmission: z.string().trim().min(1).max(60),
  image: imageRef,
  colors: z.array(colorSchema).min(1).max(8),
  isActive: z.boolean(),
};
export const carCreateBody = z.object({ ...carBase, isActive: carBase.isActive.default(true) }).strict();
export const carUpdateBody = z
  .object(carBase)
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, "Nothing to update");

export const carListQuery = z.object({
  category: z.enum(CATEGORIES).optional(),
  fuel: z.enum(FUELS).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  search: z.string().trim().max(80).optional(),
});

/* ---------- bookings ---------- */
export const bookingCreateBody = z
  .object({
    carId: carIdNum,
    name: personName,
    email,
    phone: optionalPhone,
    location: z.string().trim().min(1).max(80),
    date: isoDate,
    time: z.enum(TIME_SLOTS),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const bookingUpdateBody = z
  .object({ status: z.enum(BOOKING_STATUSES), notes: z.string().trim().max(500) })
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, "Nothing to update");

export const adminListQuery = z.object({
  status: z.string().max(20).optional(),
  type: z.string().max(20).optional(),
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/* ---------- inquiries / subscribers ---------- */
export const inquiryCreateBody = z
  .object({
    type: z.enum(INQUIRY_TYPES).default("general"),
    name: personName,
    email,
    phone: optionalPhone,
    message: z.string().trim().max(1000).optional(),
    carId: carIdNum.optional(),
    finance: z
      .object({
        down: z.coerce.number().min(0).max(100_000_000),
        rate: z.coerce.number().min(0).max(30),
        years: z.coerce.number().int().min(1).max(10),
      })
      .strict()
      .optional(),
  })
  .strict();

export const inquiryUpdateBody = z.object({ status: z.enum(INQUIRY_STATUSES) }).strict();
export const subscribeBody = z.object({ email, source: z.string().trim().max(40).optional() }).strict();

/* ---------- settings / users ---------- */
export const settingsBody = z
  .object({
    businessName: z.string().trim().min(2).max(80),
    social: z
      .object({
        instagram: optionalUrl,
        facebook: optionalUrl,
        youtube: optionalUrl,
        tiktok: optionalUrl,
        x: optionalUrl,
        linkedin: optionalUrl,
      })
      .partial()
      .strict(),
    whatsapp: z.union([z.string().trim().regex(/^\+?[0-9]{7,15}$/, "Use international format, e.g. +971500000000"), z.literal("")]),
    contact: z
      .object({
        phone: z.string().trim().max(40),
        email: z.union([email, z.literal("")]),
        address: z.string().trim().max(200),
      })
      .partial()
      .strict(),
    locations: z.array(z.string().trim().min(2).max(80)).min(1).max(12),
  })
  .partial()
  .strict();

export const userUpdateBody = z
  .object({ role: z.enum(ROLES), isActive: z.boolean() })
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, "Nothing to update");
