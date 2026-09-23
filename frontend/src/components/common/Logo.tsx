import { navigate, pathOf } from "@/lib/router";

/** The wordmark; always a link home. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <a
      href={pathOf("home")}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate("home");
      }}
      className={`es-focus text-[19px] font-semibold tracking-[-0.04em] ${className}`}
      aria-label="eSketcher home"
    >
      <span className="text-jev">e</span>Sketcher
    </a>
  );
}
