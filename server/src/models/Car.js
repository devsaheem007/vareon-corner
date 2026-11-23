import mongoose from "mongoose";
import { CATEGORIES, FUELS } from "../config/constants.js";

const colorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    accent: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
    image: { type: String, required: true, maxlength: 500 },
  },
  { _id: false },
);

const carSchema = new mongoose.Schema(
  {
    // Public numeric id: keeps the existing frontend (and any saved links) unchanged.
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    fuel: { type: String, enum: FUELS, required: true },
    price: { type: Number, required: true, min: 0 },
    hp: { type: Number, required: true, min: 0 },
    zero: { type: Number, required: true, min: 0 },
    top: { type: Number, required: true, min: 0 },
    transmission: { type: String, required: true, trim: true, maxlength: 60 },
    image: { type: String, required: true, maxlength: 500 },
    colors: { type: [colorSchema], default: [] },
    // Hidden cars stay in the database but disappear from the public site.
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export default mongoose.model("Car", carSchema);
