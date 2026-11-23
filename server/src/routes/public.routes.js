import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";
import * as cars from "../controllers/car.controller.js";
import * as bookings from "../controllers/booking.controller.js";
import * as inquiries from "../controllers/inquiry.controller.js";
import * as subscribers from "../controllers/subscriber.controller.js";
import * as settings from "../controllers/settings.controller.js";
import * as notifications from "../controllers/notification.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { authLimiter, formLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import * as s from "../validators/schemas.js";

const r = Router();

/* auth */
r.post("/auth/register", authLimiter, validate(s.registerBody), auth.register);
r.post("/auth/verify-email", authLimiter, validate(s.verifyEmailBody), auth.verifyEmail);
r.post("/auth/resend-code", authLimiter, validate(s.emailOnlyBody), auth.resendOtp);
r.post("/auth/forgot-password", authLimiter, validate(s.emailOnlyBody), auth.forgotPassword);
r.post("/auth/reset-password", authLimiter, validate(s.resetPasswordBody), auth.resetPassword);
r.post("/auth/google", authLimiter, validate(s.googleBody), auth.googleLogin);
r.post("/auth/login", authLimiter, validate(s.loginBody), auth.login);
r.post("/auth/refresh", authLimiter, auth.refresh);
r.post("/auth/logout", auth.logout);
r.get("/auth/me", requireAuth, auth.me);
r.patch("/auth/password", authLimiter, requireAuth, validate(s.changePasswordBody), auth.changePassword);
r.patch("/auth/profile", requireAuth, validate(s.profileBody), auth.updateProfile);
r.get("/me/favorites", requireAuth, auth.getFavorites);
r.put("/me/favorites", requireAuth, validate(s.favoritesBody), auth.setFavorites);

/* alerts (customers and admins each read their own) */
r.get("/notifications", requireAuth, notifications.listNotifications);
r.post("/notifications/read-all", requireAuth, notifications.markAllRead);
r.patch("/notifications/:id/read", requireAuth, validate(s.objectIdParam, "params"), notifications.markRead);

/* catalogue + site settings */
r.get("/cars", validate(s.carListQuery, "query"), cars.listCars);
r.get("/cars/:id", validate(s.idParam, "params"), cars.getCar);
r.get("/settings", settings.getSettings);

/* customer submissions */
r.post("/bookings", formLimiter, optionalAuth, validate(s.bookingCreateBody), bookings.createBooking);
r.get("/bookings/mine", requireAuth, bookings.myBookings);
r.get("/inquiries/mine", requireAuth, inquiries.myInquiries);
r.patch("/bookings/:id/cancel", requireAuth, validate(s.objectIdParam, "params"), bookings.cancelMyBooking);
r.post("/inquiries", formLimiter, optionalAuth, validate(s.inquiryCreateBody), inquiries.createInquiry);
r.post("/subscribers", formLimiter, validate(s.subscribeBody), subscribers.subscribe);

export default r;
