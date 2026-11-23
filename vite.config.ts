import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the API runs on :5000; proxying keeps cookies first-party (same origin as the site).
const api = { target: "http://localhost:5000", changeOrigin: false };

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": api, "/uploads": api } },
  build: {
    // Vendor code changes rarely, so splitting it lets browsers cache it across deploys and parse in parallel.
    rollupOptions: { output: { manualChunks: { react: ["react", "react-dom"], motion: ["framer-motion"] } } },
  },
});
