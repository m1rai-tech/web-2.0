/**
 * Web 2.0 — custom logo mark.
 * A geometric W rendered as a single clean stroke path.
 * Monochrome, inherits `currentColor` so it adapts to any context.
 */
export function LogoMark({ size = 20 }: { size?: number }) {
  const h = Math.round(size * 0.72);
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 20 14"
      fill="none"
      aria-label="Web 2.0 logo"
    >
      <path
        d="M1 1.5 L5.2 12.5 L10 4.8 L14.8 12.5 L19 1.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Full app-icon badge — logo mark inside a rounded square.
 * Used in the sidebar and anywhere a compact branded mark is needed.
 */
export function LogoBadge({ size = 44 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-xl bg-gradient-to-br from-white/[0.11] to-white/[0.04] border border-white/[0.12] flex items-center justify-center text-white shadow-[0_4px_16px_rgba(0,0,0,0.45)] shrink-0"
    >
      <LogoMark size={Math.round(size * 0.48)} />
    </div>
  );
}
