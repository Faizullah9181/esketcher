/** Jev's mark: one input, a field of options, one chosen path. Not a robot head. */
export function JevGlyph({ size = 20, className, active = true }: { size?: number; className?: string; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="4.5" cy="12" r="2.4" fill="currentColor" />
      <path d="M7 12C11.5 12 12.5 5.5 17.5 5.5" stroke={active ? "var(--color-jev)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 12H17.5" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7 12C11.5 12 12.5 18.5 17.5 18.5" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="19.5" cy="5.5" r="2.2" fill={active ? "var(--color-jev)" : "currentColor"} />
      <circle cx="19.5" cy="12" r="1.6" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.2" />
      <circle cx="19.5" cy="18.5" r="1.6" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.2" />
    </svg>
  );
}
