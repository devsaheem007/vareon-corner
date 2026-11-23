import mongoose from "mongoose";
import { BOOKING_STATUSES } from "../config/constants.js";

const bookingSchema = new mongoose.Schema(
  {
    carId: { type: Number, required: true, index: true },
    carName: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, index: true },
    phone: { type: String, trim: true, maxlength: 25, default: "" },
    location: { type: String, required: true, maxlength: 80 },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
    time: { type: String, required: true },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: BOOKING_STATUSES, default: "pending", index: true },
    // true while the slot is held (pending/confirmed).
    active: { type: Boolean, default: true, index: true },
    // "carId|location|date|time" while the slot is held, absent otherwise. The sparse unique index
    // below therefore allows one held booking per slot, and frees it again on cancel / complete.
    slotKey: { type: String, select: false },
  },
  { timestamps: true, toJSON: { transform: (_d, r) => { delete r.__v; delete r.slotKey; return r; } } },
);

bookingSchema.pre("validate", function setActive(next) {
  this.active = this.status === "pending" || this.status === "confirmed";
  this.slotKey = this.active ? [this.carId, this.location, this.date, this.time].join("|") : undefined;
  next();
});

bookingSchema.index({ slotKey: 1 }, { unique: true, sparse: true });

export default mongoose.model("Booking", bookingSchema);
