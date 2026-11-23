const SIZES = [96, 192, 384, 512] as const;
const pick = (px: number) => SIZES.find((s) => s >= px) ?? 1024;
const url = (s: number) => (s === 1024 ? "/brand/logo-round-1024.png" : `/brand/logo-${s}.webp`);

/**
 * The Vareon Motors mark, cropped to a perfect circle (same artwork, nothing redrawn).
 * Small, pre-sized WebP files are served (2-14 KB) instead of the 766 KB master, so the logo appears instantly.
 */
export default function RoundLogo({
  size = 48,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const one = pick(size);
  const two = pick(size * 2);
  return (
    <img
      src={url(one)}
      srcSet={one === two ? undefined : `${url(one)} 1x, ${url(two)} 2x`}
      alt="Vareon Motors"
      width={size}
      height={size}
      decoding={priority ? "sync" : "async"}
      loading={priority ? "eager" : "lazy"}
      {...(priority ? { fetchPriority: "high" as const } : {})}
      draggable={false}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}
