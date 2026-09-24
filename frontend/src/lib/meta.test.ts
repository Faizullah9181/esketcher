import { afterEach, describe, expect, it } from "vitest";

import { applyRouteMeta } from "./meta";

afterEach(() => {
  document.head.innerHTML = "";
});

describe("applyRouteMeta", () => {
  it("names the page in the title and gives the studio its own canonical", () => {
    document.head.innerHTML = '<link rel="canonical" href="https://esketcher.faiz-ai.dev/" /><meta property="og:url" content="https://esketcher.faiz-ai.dev/" /><meta name="description" content="x" />';
    applyRouteMeta("studio");
    expect(document.title).toBe("Studio · eSketcher");
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href).toBe("https://esketcher.faiz-ai.dev/studio");
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:url"]')!.content).toBe("https://esketcher.faiz-ai.dev/studio");
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')!.content).toMatch(/studio/i);
    applyRouteMeta("home");
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href).toBe("https://esketcher.faiz-ai.dev/");
    expect(document.title).toMatch(/generative painting/);
  });

  it("creates the tags when the page has none and falls back to the current origin", () => {
    document.head.innerHTML = '<link rel="canonical" href="not a url" />';
    applyRouteMeta("studio");
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href).toBe(`${window.location.origin}/studio`);
    expect(document.querySelector('meta[name="description"]')).not.toBeNull();
  });
});
