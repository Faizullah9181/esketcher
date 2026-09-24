import type { ReactNode } from "react";

import { navigate, pathOf, type Route } from "@/lib/router";

/** An in-app link: a real `href` for new tabs and crawlers, History navigation for plain clicks. */
export function RouteLink({ to, className = "", children, current = false, role }: { to: Route; className?: string; children: ReactNode; current?: boolean; role?: string }) {
  return (
    <a
      href={pathOf(to)}
      role={role}
      aria-current={current ? "page" : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      className={`es-focus ${className}`}
    >
      {children}
    </a>
  );
}
