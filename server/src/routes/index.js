import { Router } from "express";
import mongoose from "mongoose";
import admin from "./admin.routes.js";
import pub from "./public.routes.js";

const r = Router();
r.get("/health", (_req, res) =>
  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    status: mongoose.connection.readyState === 1 ? "ok" : "degraded",
    uptime: Math.round(process.uptime()),
  }),
);
r.use("/admin", admin);
r.use("/", pub);
export default r;
