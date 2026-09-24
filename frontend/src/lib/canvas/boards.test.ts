import { beforeEach, expect, it } from "vitest";

import { setupDesk } from "@/test/desk";

import { zoomToStart } from "./boards";

beforeEach(() => setupDesk(4));

it("fits the whole desk on wide screens and the first two boards on phones", async () => {
  const { desk } = setupDesk(4);
  zoomToStart(desk);
  const wide = desk.getZoom();
  desk.setViewport({ x: 0, y: 0, w: 390, h: 700 });
  zoomToStart(desk);
  const phone = desk.getViewportPageBounds();
  expect(phone.w).toBeLessThan(800);
  expect(desk.getZoom()).not.toBe(wide);
  desk.setViewport({ x: 0, y: 0, w: 844, h: 300 });
  zoomToStart(desk);
  expect(desk.getViewportPageBounds().h).toBeLessThan(700);
  const single = setupDesk(1).desk;
  single.setViewport({ x: 0, y: 0, w: 390, h: 700 });
  zoomToStart(single);
  expect(single.getZoom()).toBeLessThanOrEqual(1);
});
