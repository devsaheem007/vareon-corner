import mongoose from "mongoose";

const subscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    active: { type: Boolean, default: true },
    source: { type: String, default: "footer", maxlength: 40 },
  },
  { timestamps: true, toJSON: { transform: (_d, r) => { delete r.__v; return r; } } },
);

export default mongoose.model("Subscriber", subscriberSchema);
