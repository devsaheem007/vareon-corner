import { Facebook, Instagram, Linkedin, MessageCircle, Play, Twitter } from "lucide-react";
import type { ReactNode } from "react";
import type { SiteSettings } from "../lib/types";

// lucide has no TikTok glyph, so draw a matching 15px outline icon.
const TikTok = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

/** Footer social icons - same `glass rounded-full` buttons as before. Links come from the admin dashboard. */
export default function SocialLinks({ settings }: { settings: SiteSettings }) {
  const { social, whatsappUrl } = settings;
  const items: { key: string; label: string; href: string; icon: ReactNode; always?: boolean }[] = [
    { key: "wa", label: "WhatsApp", href: whatsappUrl, icon: <MessageCircle size={15} />, always: true },
    { key: "yt", label: "YouTube", href: social.youtube, icon: <Play size={15} />, always: true },
    { key: "ig", label: "Instagram", href: social.instagram, icon: <Instagram size={15} /> },
    { key: "fb", label: "Facebook", href: social.facebook, icon: <Facebook size={15} /> },
    { key: "tt", label: "TikTok", href: social.tiktok, icon: <TikTok /> },
    { key: "x", label: "X", href: social.x, icon: <Twitter size={15} /> },
    { key: "in", label: "LinkedIn", href: social.linkedin, icon: <Linkedin size={15} /> },
  ];
  return (
    <>
      {items
        .filter((i) => i.href || i.always)
        .map((i) => (
          <a
            key={i.key}
            href={i.href || "#"}
            aria-label={i.label}
            {...(i.href ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="glass rounded-full p-2"
          >
            {i.icon}
          </a>
        ))}
    </>
  );
}
