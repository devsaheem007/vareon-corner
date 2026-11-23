import Settings, { publicSettings } from "../models/Settings.js";
import { asyncHandler } from "../utils/helpers.js";

export const getSettings = asyncHandler(async (_req, res) => {
  res.set("Cache-Control", "public, max-age=60");
  res.json({ settings: publicSettings(await Settings.getSite()) });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const $set = {};
  for (const [key, value] of Object.entries(req.body)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [sub, v] of Object.entries(value)) $set[`${key}.${sub}`] = v; // partial nested update
    } else {
      $set[key] = value;
    }
  }
  await Settings.updateOne({ key: "site" }, { $set }, { upsert: true });
  res.json({ settings: publicSettings(await Settings.getSite()) });
});
