import PasswordInput from "../../components/PasswordInput";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import type { SiteSettings } from "../../lib/types";
import { Btn, Card, Field, inputCls, useToast } from "../ui";

const SOCIALS = [
  ["instagram", "Instagram"], ["facebook", "Facebook"], ["youtube", "YouTube"],
  ["tiktok", "TikTok"], ["x", "X (Twitter)"], ["linkedin", "LinkedIn"],
] as const;

function PasswordCard() {
  const notify = useToast();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card title="Change password" className="mt-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Current password"><PasswordInput className={inputCls} autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
        <Field label="New password" hint="10+ characters with upper, lower case and a number. Other devices are signed out."><PasswordInput className={inputCls} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      </div>
      <Btn className="mt-5" disabled={busy || !cur || !next} onClick={async () => {
        setBusy(true);
        try { await api.patch("/auth/password", { currentPassword: cur, newPassword: next }); notify("Password updated"); setCur(""); setNext(""); }
        catch (e) { notify(errorMessage(e)); }
        setBusy(false);
      }}>Update password</Btn>
    </Card>
  );
}

export default function SettingsPanel() {
  const notify = useToast();
  const [s, setS] = useState<SiteSettings | null>(null);
  const [locations, setLocations] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ settings: SiteSettings }>("/settings").then((r) => { setS(r.settings); setLocations(r.settings.locations.join("\n")); }).catch((e) => notify(errorMessage(e)));
  }, [notify]);
  if (!s) return <p className="text-sm text-white/40">Loading…</p>;

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.put<{ settings: SiteSettings }>("/admin/settings", {
        businessName: s.businessName,
        social: s.social,
        whatsapp: s.whatsapp,
        contact: s.contact,
        locations: locations.split("\n").map((l) => l.trim()).filter(Boolean),
      });
      setS(r.settings);
      notify("Settings saved - live on the website within a minute");
    } catch (e) {
      notify(errorMessage(e));
    }
    setBusy(false);
  };

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.3em] text-crimson">Website</p>
      <h1 className="font-display text-4xl font-bold">Settings</h1>

      <Card title="Social media & messaging" className="mt-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIALS.map(([k, label]) => (
            <Field key={k} label={label} hint={k === "instagram" ? "Full https:// profile link. Leave empty to hide the icon." : undefined}>
              <input className={inputCls} placeholder="https://" value={s.social[k]} onChange={(e) => setS({ ...s, social: { ...s.social, [k]: e.target.value } })} />
            </Field>
          ))}
          <Field label="WhatsApp number" hint="International format, e.g. +971500000000. Powers the WhatsApp icon (wa.me chat link).">
            <input className={inputCls} placeholder="+971…" value={s.whatsapp} onChange={(e) => setS({ ...s, whatsapp: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card title="Business" className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name"><input className={inputCls} value={s.businessName} onChange={(e) => setS({ ...s, businessName: e.target.value })} /></Field>
          <Field label="Phone"><input className={inputCls} value={s.contact.phone} onChange={(e) => setS({ ...s, contact: { ...s.contact, phone: e.target.value } })} /></Field>
          <Field label="Contact email"><input className={inputCls} type="email" value={s.contact.email} onChange={(e) => setS({ ...s, contact: { ...s.contact, email: e.target.value } })} /></Field>
          <Field label="Address"><input className={inputCls} value={s.contact.address} onChange={(e) => setS({ ...s, contact: { ...s.contact, address: e.target.value } })} /></Field>
          <div className="sm:col-span-2"><Field label="Showroom locations" hint="One per line. These are the choices guests see when booking a test drive."><textarea rows={5} className={inputCls} value={locations} onChange={(e) => setLocations(e.target.value)} /></Field></div>
        </div>
        <Btn className="mt-5" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</Btn>
      </Card>

      <PasswordCard />
    </div>
  );
}
