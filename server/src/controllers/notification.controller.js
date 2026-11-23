import Notification from "../models/Notification.js";
import { AppError, asyncHandler } from "../utils/helpers.js";

export const listNotifications = asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);
  res.set("Cache-Control", "no-store");
  res.json({ items, unread });
});

export const markRead = asyncHandler(async (req, res) => {
  const { matchedCount } = await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { $set: { readAt: new Date() } });
  if (!matchedCount) throw new AppError(404, "Notification not found");
  res.json({ ok: true });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
});
