import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "../config/paths.js";
import { detectImageType } from "../middleware/upload.js";
import { AppError, asyncHandler } from "../utils/helpers.js";

export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, "No image received");
  const ext = detectImageType(req.file.buffer);
  if (!ext) throw new AppError(415, "File content is not a supported image");
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), req.file.buffer, { flag: "wx" });
  res.status(201).json({ url: `/uploads/${name}` });
});
