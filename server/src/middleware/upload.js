import multer from "multer";
import { AppError } from "../utils/helpers.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new AppError(415, "Only JPEG, PNG, WebP or AVIF images are allowed")),
});

/** Detects the real image type from magic bytes (never trust the client's mimetype / filename). */
export function detectImageType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(4, 8).toString("ascii") === "ftyp" && ["avif", "avis"].includes(buf.subarray(8, 12).toString("ascii"))) return "avif";
  return null;
}
