import { Router } from "express";
import * as admin from "../controllers/admin.controller.js";
import * as cars from "../controllers/car.controller.js";
import * as bookings from "../controllers/booking.controller.js";
import * as inquiries from "../controllers/inquiry.controller.js";
import * as subscribers from "../controllers/subscriber.controller.js";
import * as settings from "../controllers/settings.controller.js";
import * as uploads from "../controllers/upload.controller.js";
import { requireAdmin } from "../middleware/auth.js";
import { imageUpload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import * as s from "../validators/schemas.js";

const r = Router();
r.use(requireAdmin); // every route below needs an authenticated admin

r.get("/stats", admin.stats);

r.get("/cars", validate(s.carListQuery, "query"), cars.listAllCarsAdmin);
r.post("/cars", validate(s.carCreateBody), cars.createCar);
r.patch("/cars/:id", validate(s.idParam, "params"), validate(s.carUpdateBody), cars.updateCar);
r.delete("/cars/:id", validate(s.idParam, "params"), cars.deleteCar);

r.get("/bookings", validate(s.adminListQuery, "query"), bookings.listBookings);
r.patch("/bookings/:id", validate(s.objectIdParam, "params"), validate(s.bookingUpdateBody), bookings.updateBooking);
r.delete("/bookings/:id", validate(s.objectIdParam, "params"), bookings.deleteBooking);

r.get("/inquiries", validate(s.adminListQuery, "query"), inquiries.listInquiries);
r.patch("/inquiries/:id", validate(s.objectIdParam, "params"), validate(s.inquiryUpdateBody), inquiries.updateInquiry);
r.delete("/inquiries/:id", validate(s.objectIdParam, "params"), inquiries.deleteInquiry);

r.get("/subscribers/export", subscribers.exportSubscribers);
r.get("/subscribers", validate(s.adminListQuery, "query"), subscribers.listSubscribers);
r.delete("/subscribers/:id", validate(s.objectIdParam, "params"), subscribers.deleteSubscriber);

r.get("/users", validate(s.adminListQuery, "query"), admin.listUsers);
r.patch("/users/:id", validate(s.objectIdParam, "params"), validate(s.userUpdateBody), admin.updateUser);

r.put("/settings", validate(s.settingsBody), settings.updateSettings);
r.post("/uploads", imageUpload.single("image"), uploads.uploadImage);

export default r;
