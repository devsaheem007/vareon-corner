import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Car from "../models/Car.js";
import Settings from "../models/Settings.js";
import { AppError, asyncHandler, containsFilter } from "../utils/helpers.js";
import { notifyAdmins, notifyUser } from "../utils/notify.js";

const { trusted } = mongoose;
const DAY = 86_400_000;
const isoDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
const MAX_ACTIVE_PER_EMAIL = 5;

export const createBooking = asyncHandler(async (req, res) => {
  const { carId, name, email, phone, location, date, time, notes } = req.body;

  const car = await Car.findOne({ id: carId, isActive: true });
  if (!car) throw new AppError(404, "Vehicle not found");

  const site = await Settings.getSite();
  if (!site.locations.includes(location)) throw new AppError(400, "Unknown showroom location");

  // Allow "today" in every timezone (UTC-1 .. UTC+14) but never the past or >1 year ahead.
  if (date < isoDay(-1)) throw new AppError(400, "Please choose today or a future date");
  if (date > isoDay(366)) throw new AppError(400, "Bookings open up to one year ahead");

  const open = await Booking.countDocuments({ email, active: true, date: trusted({ $gte: isoDay(-1) }) });
  if (open >= MAX_ACTIVE_PER_EMAIL) throw new AppError(429, "You already have several upcoming test drives. Please contact us to arrange more.");

  try {
    const booking = await Booking.create({
      carId,
      carName: car.name,
      user: req.user?._id,
      name,
      email,
      phone: phone || "",
      location,
      date,
      time,
      notes: notes || "",
    });
    const when = `${date} at ${time}`;
    await notifyAdmins({
      type: "booking",
      title: `New test drive: ${car.name}`,
      body: `${name} · ${when} · ${location}`,
      link: "/admin#bookings",
      mail: { lines: [["Guest", name], ["Email", email], ["Phone", phone || "-"], ["Vehicle", car.name], ["When", when], ["Showroom", location]], linkLabel: "Open test drives" },
    });
    if (req.user) {
      await notifyUser(req.user, {
        type: "booking",
        title: "Test drive requested",
        body: `${car.name} · ${when}`,
        link: "account:drives",
        mail: { lines: [["Vehicle", car.name], ["When", when], ["Showroom", location], ["Status", "Pending - we'll confirm shortly"]] },
      });
    }
    res.status(201).json({ booking, message: `Test drive requested for ${car.name}` });
  } catch (err) {
    if (err?.code === 11000) throw new AppError(409, "That time slot is already booked for this vehicle. Please choose another.");
    throw err;
  }
});

export const myBookings = asyncHandler(async (req, res) => {
  // Matched by account id only: e-mail addresses are not verified, so matching on them would leak other people's bookings.
  const bookings = await Booking.find({ user: req.user._id }).sort({ date: -1 });
  res.json({ bookings });
});

export const cancelMyBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
  if (!booking) throw new AppError(404, "Booking not found");
  if (booking.status !== "pending" && booking.status !== "confirmed") throw new AppError(400, "This booking can no longer be cancelled");
  booking.status = "cancelled"; // frees the slot for other guests
  await booking.save();
  await notifyAdmins({
    type: "booking",
    title: `Test drive cancelled: ${booking.carName}`,
    body: `${booking.name} cancelled ${booking.date} at ${booking.time}`,
    link: "/admin#bookings",
    mail: { lines: [["Guest", booking.name], ["Vehicle", booking.carName], ["Was", `${booking.date} at ${booking.time}`]], linkLabel: "Open test drives" },
  });
  res.json({ booking });
});

export const listBookings = asyncHandler(async (req, res) => {
  const { status, search, page, limit } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    const rx = containsFilter(search);
    filter.$or = [{ name: rx }, { email: rx }, { carName: rx }];
  }
  const [items, total] = await Promise.all([
    Booking.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Booking.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

export const updateBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError(404, "Booking not found");
  const before = booking.status;
  booking.set(req.body);
  try {
    await booking.save();
  } catch (err) {
    if (err?.code === 11000) throw new AppError(409, "Another active booking already holds that slot");
    throw err;
  }
  if (req.body.status && req.body.status !== before && booking.user) {
    await notifyUser(booking.user, {
      type: "booking",
      title: `Your test drive is ${booking.status}`,
      body: `${booking.carName} · ${booking.date} at ${booking.time}`,
      link: "account:drives",
      mail: { lines: [["Vehicle", booking.carName], ["When", `${booking.date} at ${booking.time}`], ["Showroom", booking.location], ["Status", booking.status]] },
    });
  }
  res.json({ booking });
});

export const deleteBooking = asyncHandler(async (req, res) => {
  const { deletedCount } = await Booking.deleteOne({ _id: req.params.id });
  if (!deletedCount) throw new AppError(404, "Booking not found");
  res.json({ message: "Booking deleted" });
});
