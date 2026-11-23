import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: any;
  }
}

let loader: Promise<void> | null = null;
const loadGsi = () =>
  (loader ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loader = null;
      reject(new Error("Google script blocked"));
    };
    document.head.appendChild(s);
  }));

/** Official "Continue with Google" button (Google Identity Services). Hidden when no client id is configured. */
export default function GoogleButton({ clientId, onCredential }: { clientId?: string; onCredential: (credential: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let dead = false;
    loadGsi()
      .then(() => {
        if (dead || !box.current || !window.google) return;
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r: { credential: string }) => cb.current(r.credential) });
        window.google.accounts.id.renderButton(box.current, { theme: "filled_black", size: "large", shape: "pill", text: "continue_with", width: 320, logo_alignment: "left" });
      })
      .catch(() => !dead && setFailed(true));
    return () => {
      dead = true;
    };
  }, [clientId]);

  if (!clientId || failed) return null;
  return <div ref={box} className="flex min-h-[44px] justify-center" />;
}
