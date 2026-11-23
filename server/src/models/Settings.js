import mongoose from "mongoose";
import { DEFAULT_LOCATIONS } from "../config/constants.js";
import env from "../config/env.js";

const str = { type: String, trim: true, maxlength: 300, default: "" };

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "site", unique: true },
    businessName: { type: String, default: "VAREON MOTORS" },
    social: { instagram: str, facebook: str, youtube: str, tiktok: str, x: str, linkedin: str },
    // International format digits, e.g. +971500000000 - powers the WhatsApp click-to-chat link.
    whatsapp: { type: String, trim: true, maxlength: 20, default: "" },
    contact: { phone: str, email: str, address: str },
    locations: { type: [String], default: DEFAULT_LOCATIONS },
  },
  { timestamps: true },
);

settingsSchema.statics.getSite = async function getSite() {
  return (await this.findOne({ key: "site" })) ?? (await this.create({ key: "site" }));
};

export function publicSettings(doc) {
  const o = doc.toObject();
  const digits = (o.whatsapp || "").replace(/\D/g, "");
  return {
    businessName: o.businessName,
    social: o.social,
    whatsapp: o.whatsapp,
    whatsappUrl: digits ? `https://wa.me/${digits}` : "",
    contact: o.contact,
    locations: o.locations,
    googleClientId: env.GOOGLE_CLIENT_ID || "",
  };
}

export default mongoose.model("Settings", settingsSchema);
