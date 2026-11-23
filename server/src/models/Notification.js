import mongoose from "mongoose";
import { NOTIFICATION_TYPES } from "../config/constants.js";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "system" },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, maxlength: 400, default: "" },
    // Where clicking the alert should lead: "/admin#bookings" or "account:drives".
    link: { type: String, maxlength: 80, default: "" },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: { transform: (_d, r) => { delete r.__v; return r; } } },
);
notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
