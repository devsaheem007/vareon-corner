import Subscriber from "../models/Subscriber.js";
import { AppError, asyncHandler, containsFilter, csvCell } from "../utils/helpers.js";
import { notifyAdmins } from "../utils/notify.js";

export const subscribe = asyncHandler(async (req, res) => {
  const { email, source } = req.body;
  try {
    const r = await Subscriber.updateOne({ email }, { $set: { active: true }, $setOnInsert: { source: source || "footer" } }, { upsert: true });
    if (r.upsertedCount) await notifyAdmins({ type: "subscriber", title: "New subscriber", body: email, link: "/admin#subscribers" });
  } catch (err) {
    if (err?.code !== 11000) throw err; // concurrent double-submit: already subscribed
  }
  // Same response whether new or existing, so the list cannot be probed for addresses.
  res.status(201).json({ message: "You're on the Vareon Motors list" });
});

export const listSubscribers = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const filter = search ? { email: containsFilter(search) } : {};
  const [items, total] = await Promise.all([
    Subscriber.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Subscriber.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

export const deleteSubscriber = asyncHandler(async (req, res) => {
  const sub = await Subscriber.findByIdAndDelete(req.params.id);
  if (!sub) throw new AppError(404, "Subscriber not found");
  res.json({ message: "Subscriber removed" });
});

export const exportSubscribers = asyncHandler(async (_req, res) => {
  const subs = await Subscriber.find({ active: true }).sort({ createdAt: -1 });
  const rows = [["email", "source", "subscribed_at"], ...subs.map((s) => [s.email, s.source, s.createdAt.toISOString()])];
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="vareon-subscribers.csv"',
  });
  res.send(rows.map((r) => r.map(csvCell).join(",")).join("\r\n"));
});
