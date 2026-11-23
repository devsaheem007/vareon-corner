import mongoose from "mongoose";
import { INQUIRY_STATUSES, INQUIRY_TYPES } from "../config/constants.js";

const inquirySchema = new mongoose.Schema(
  {
    type: { type: String, enum: INQUIRY_TYPES, default: "general", index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 25, default: "" },
    message: { type: String, trim: true, maxlength: 1000, default: "" },
    carId: Number,
    carName: String,
    finance: {
      price: Number,
      down: Number,
      rate: Number,
      years: Number,
      monthly: Number,
    },
    status: { type: String, enum: INQUIRY_STATUSES, default: "new", index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, toJSON: { transform: (_d, r) => { delete r.__v; return r; } } },
);

export default mongoose.model("Inquiry", inquirySchema);
