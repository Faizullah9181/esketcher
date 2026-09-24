import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { resetTransition } from "@/lib/transition";

import GalleryPage from "./GalleryPage";
import { FILM, PAINTINGS, STUDIO } from "./items";

const originalMatchMedia = window.matchMedia;
let reduced = false;

beforeEach(() => {
  reduced = false;
  window.matchMedia = ((query: string) => ({ matches: query.includes("reduced-motion") && reduced, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});
afterEach(() => {
  resetTransition();
  vi.unstubAllGlobals();
  window.matchMedia = originalMatchMedia;
  window.history.replaceState({}, "", "/");
});

it("shows the film, the paintings and the studio, and asks the server for nothing", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { container } = render(<GalleryPage />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Jev's call");
  expect(screen.getAllByRole("button", { name: /^Open (?!studio)/ })).toHaveLength(PAINTINGS.length + STUDIO.length);
  // architecture diagrams are repo docs, not part of the site
  expect(container.querySelector('img[src$=".svg"]')).toBeNull();
  const [loop, full] = [...container.querySelectorAll("video")];
  expect(loop).toHaveAttribute("src", FILM.loop.src);
  expect(loop.autoplay).toBe(true);
  expect(full).toHaveAttribute("src", FILM.full.src);
  expect(full).toHaveAttribute("preload", "none");
  // every image reserves its box and waits until it scrolls near
  for (const img of container.querySelectorAll("main img")) {
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("width");
  }
  expect(fetch).not.toHaveBeenCalled();
});

it("leaves the loop still when motion is reduced", () => {
  reduced = true;
  const { container } = render(<GalleryPage />);
  const loop = container.querySelector("video")!;
  expect(loop.autoplay).toBe(false);
  expect(loop.controls).toBe(true);
});

it("opens a painting full size and steps through the set", async () => {
  render(<GalleryPage />);
  fireEvent.click(screen.getByRole("button", { name: `Open ${PAINTINGS[1].title}` }));
  const dialog = screen.getByRole("dialog", { name: PAINTINGS[1].title });
  expect(within(dialog).getByRole("img")).toHaveAttribute("src", PAINTINGS[1].src);
  fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(screen.getByRole("dialog", { name: PAINTINGS[2].title })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "ArrowLeft" });
  fireEvent.keyDown(window, { key: "ArrowLeft" });
  expect(screen.getByRole("dialog", { name: PAINTINGS[0].title })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(screen.getByRole("dialog", { name: PAINTINGS[PAINTINGS.length - 1].title })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("dialog", { name: PAINTINGS[0].title })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("closes the full view from its button or the backdrop", async () => {
  render(<GalleryPage />);
  fireEvent.click(screen.getByRole("button", { name: `Open ${STUDIO[0].title}` }));
  const dialog = screen.getByRole("dialog", { name: STUDIO[0].title });
  fireEvent.click(within(dialog).getByRole("img")); // clicking the picture itself keeps it open
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: `Open ${STUDIO[1].title}` }));
  fireEvent.click(screen.getByRole("dialog"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("links home and opens the studio", () => {
  reduced = true;
  render(<GalleryPage />);
  expect(screen.getByRole("link", { name: "Gallery" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("link", { name: "Home" }));
  expect(window.location.pathname).toBe("/");
  act(() => fireEvent.click(screen.getAllByRole("button", { name: /Open studio/ })[0]));
  expect(window.location.pathname).toBe("/studio");
});

it("leaves modifier clicks on its links to the browser", () => {
  render(<GalleryPage />);
  fireEvent.click(screen.getByRole("link", { name: "Home" }), { metaKey: true });
  expect(window.location.pathname).toBe("/");
  window.history.replaceState({}, "", "/gallery");
  fireEvent.click(screen.getByRole("link", { name: "Home" }), { ctrlKey: true });
  expect(window.location.pathname).toBe("/gallery");
});
