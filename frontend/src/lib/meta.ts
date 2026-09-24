import { pathOf, type Route } from "./router";

const TITLES: Record<Route, string> = {
  home: "eSketcher: generative painting canvas",
  studio: "Studio · eSketcher",
  gallery: "Gallery · eSketcher",
};

const DESCRIPTIONS: Record<Route, string> = {
  home: "eSketcher: a generative painting canvas. 105 procedural sketches, 121 animated paint materials, and Jev, a calibrated decision model, choosing the colours.",
  studio: "The eSketcher studio: an infinite desk of procedural sketches where Jev picks the paint for every region.",
  gallery: "Sketches painted by Jev, the studio mid-decision, and a film of a full fifty-sketch run.",
};

function meta(selector: string, create: () => HTMLElement): HTMLElement {
  const existing = document.head.querySelector<HTMLElement>(selector);
  if (existing) return existing;
  const el = create();
  document.head.appendChild(el);
  return el;
}

/**
 * Per-route document metadata for a single-page site: title, description and a
 * canonical that names the page itself, not the site root. The canonical's origin
 * comes from index.html so previews on other hosts still point at the real site.
 */
export function applyRouteMeta(route: Route): void {
  document.title = TITLES[route];
  const canonical = meta('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" })) as HTMLLinkElement;
  const origin = safeOrigin(canonical.getAttribute("href")) ?? window.location.origin;
  canonical.href = `${origin}${pathOf(route)}`;
  const og = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  if (og) og.content = canonical.href;
  const description = meta('meta[name="description"]', () => Object.assign(document.createElement("meta"), { name: "description" })) as HTMLMetaElement;
  description.content = DESCRIPTIONS[route];
}

function safeOrigin(href: string | null): string | null {
  if (!href) return null;
  try {
    return new URL(href).origin;
  } catch {
    return null;
  }
}
