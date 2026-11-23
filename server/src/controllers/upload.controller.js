import crypto from "node:crypto";
import cloudinary, { cloudinaryConfigured } from "../config/cloudinary.js";
import { detectImageType } from "../middleware/upload.js";
import { AppError, asyncHandler } from "../utils/helpers.js";

const MIME_BY_TYPE = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

// Cloudinary's SDK is callback-based, so wrap it in a Promise.
function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(options, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      })
      .end(buffer);
  });
}

function validateCloudinaryUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError(400, "No image received");
  }

  const detectedType = detectImageType(req.file.buffer);

  if (!detectedType) {
    throw new AppError(415, "File content is not a supported image");
  }

  if (MIME_BY_TYPE[detectedType] !== req.file.mimetype) {
    throw new AppError(
      415,
      "File content does not match its declared image type",
    );
  }

  if (!cloudinaryConfigured) {
    throw new AppError(503, "Image storage is not configured");
  }

  const result = await uploadBuffer(req.file.buffer, {
    folder: "vareon",
    public_id: crypto.randomUUID(),
    resource_type: "image",
    allowed_formats: ["jpg", "png", "webp", "avif"],
  });

  if (!validateCloudinaryUrl(result?.secure_url)) {
    throw new AppError(502, "Image storage returned an invalid response");
  }

  res.status(201).json({
    url: result.secure_url,
  });
});
