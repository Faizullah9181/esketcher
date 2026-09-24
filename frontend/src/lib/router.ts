import { useSyncExternalStore } from "react";

/** Three routes don't need a router library: the History API and one event. */
export type Route = "home" | "studio" | "gallery";

const PATHS: Record<Route, string> = { home: "/", studio: "/studio", gallery: "/gallery" };
const EVENT = "esketcher:navigate";

export function routeOf(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(PATHS) as Route[]).find((route) => PATHS[route] === path) ?? "home";
}

export function pathOf(route: Route): string {
  return PATHS[route];
}

export function navigate(route: Route): void {
  if (routeOf(window.location.pathname) === route) return;
  window.history.pushState({}, "", PATHS[route]);
  window.dispatchEvent(new Event(EVENT));
  window.scrollTo?.(0, 0);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => routeOf(window.location.pathname), () => "home");
}
