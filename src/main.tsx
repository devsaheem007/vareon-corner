import React, { Suspense, lazy, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { BrandLoader } from "./components/SplashScreen";
import "./index.css";

// The staff console lives at /admin and is code-split so visitors never download it.
/** Hands over from the static boot screen (index.html) to the React app once React has painted its first frame. */
function BootOff() {
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById("boot")?.remove()));
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}

const AdminApp = lazy(() => import("./admin/AdminApp"));
const isAdmin = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BootOff />
    {isAdmin ? (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-ink">
            <BrandLoader />
          </div>
        }
      >
        <AdminApp />
      </Suspense>
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </React.StrictMode>,
);
