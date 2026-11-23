import { ZodError } from "zod";
import mongoose from "mongoose";
import multer from "multer";
import env from "../config/env.js";
import { AppError } from "../utils/helpers.js";

export const notFound = (req, _res, next) => next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.expose ? err.message : "Something went wrong";
  let details;
  const code = err.code && typeof err.code === "string" ? err.code : undefined;

  if (err instanceof ZodError) {
    status = 400;
    message = "Validation failed";
    details = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = "Validation failed";
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = "Invalid identifier";
  } else if (err?.code === 11000) {
    status = 409;
    message = "That record already exists";
  } else if (err instanceof multer.MulterError) {
    status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    message = err.code === "LIMIT_FILE_SIZE" ? "Image is too large (max 5 MB)" : "Upload failed";
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Malformed JSON body";
  } else if (err.type === "entity.too.large") {
    status = 413;
    message = "Request body too large";
  } else if (err.message === "Not allowed by CORS") {
    status = 403;
    message = "Origin not allowed";
  } else if (err.details) {
    details = err.details;
  }

  if (status >= 500) {
    if (!env.isTest || process.env.LOG_ERRORS) console.error(`[${req.method} ${req.originalUrl}]`, err);
    message = "Something went wrong";
  }

  res.status(status).json({ status: "error", message, ...(code && err.expose ? { code } : {}), ...(details ? { details } : {}) });
}
