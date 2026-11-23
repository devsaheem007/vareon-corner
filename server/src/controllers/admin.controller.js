import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Car from "../models/Car.js";
import Inquiry from "../models/Inquiry.js";
import Subscriber from "../models/Subscriber.js";
import User from "../models/User.js";
import { AppError, asyncHandler, containsFilter } from "../utils/helpers.js";

const { trusted } = mongoose;
const countBy = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));

export const stats = asyncHandler(async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const [cars, activeCars, users, subscribers, newInquiries, upcoming, byStatus, byCategory, recentBookings, recentInquiries] =
    await Promise.all([
      Car.countDocuments({}),
      Car.countDocuments({ isActive: true }),
      User.countDocuments({}),
      Subscriber.countDocuments({ active: true }),
      Inquiry.countDocuments({ status: "new" }),
      Booking.countDocuments({ active: true, date: trusted({ $gte: today }) }),
      Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Car.aggregate([{ $match: { isActive: true } }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
      Booking.find({}).sort({ createdAt: -1 }).limit(6),
      Inquiry.find({}).sort({ createdAt: -1 }).limit(6),
    ]);
  res.json({
    totals: { cars, activeCars, users, subscribers, newInquiries, upcomingBookings: upcoming },
    bookingsByStatus: countBy(byStatus),
    carsByCategory: countBy(byCategory),
    recentBookings,
    recentInquiries,
  });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const filter = {};
  if (search) {
    const rx = containsFilter(search);
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, "User not found");
  if (String(user._id) === String(req.user._id)) {
    throw new AppError(400, "You cannot change your own role or status");
  }
  user.set(req.body);
  if (req.body.isActive === false) user.refreshTokens = []; // kill existing sessions
  await user.save();
  res.json({ user });
});
