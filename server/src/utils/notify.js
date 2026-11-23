import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { alertEmail } from "./emails.js";
import { sendMailSafe } from "./mailer.js";

/** Alerts must never break the request that triggered them. */
async function safe(fn) {
  try {
    await fn();
  } catch (err) {
    console.error("[notify]", err.message);
  }
}

/**
 * In-app alert for every active admin (+ one e-mail to all admin addresses when `mail` is given).
 * mail = { lines: [[label, value], ...], linkLabel }
 */
export const notifyAdmins = ({ type, title, body = "", link = "", mail }) =>
  safe(async () => {
    const admins = await User.find({ role: "admin", isActive: true }).select("email");
    if (!admins.length) return;
    await Notification.insertMany(admins.map((a) => ({ user: a._id, type, title, body, link })));
    if (mail) sendMailSafe({ to: admins.map((a) => a.email), ...alertEmail({ title, link, ...mail }) });
  });

/** In-app alert for one customer (+ e-mail, only to verified accounts - never to addresses typed into a form). */
export const notifyUser = (userOrId, { type, title, body = "", link = "", mail }) =>
  safe(async () => {
    if (!userOrId) return;
    const user = userOrId.email ? userOrId : await User.findById(userOrId);
    if (!user) return;
    await Notification.create({ user: user._id, type, title, body, link });
    if (mail && user.emailVerified !== false) sendMailSafe({ to: user.email, ...alertEmail({ title, ...mail }) });
  });
