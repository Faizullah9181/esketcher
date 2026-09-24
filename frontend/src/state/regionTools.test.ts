import { beforeEach, expect, it, vi } from "vitest";

import type { Desk } from "@/lib/desk/desk";
import { boardOf, setupDesk } from "@/test/desk";

import { actOnRegion, hoverRegion, regionUnder } from "./regionTools";
import { useStudio } from "./studio";

vi.mock("./jevController", () => ({ requestDecision: vi.fn(async () => null), applyManual: vi.fn(() => true) }));
const controller = await import("./jevController");

let desk: Desk;
let id: string;
const iris = { x: 160, y: 200 }; // the Watcher's iris sits at the board centre

beforeEach(() => {
  vi.clearAllMocks();
  ({ desk, ids: [id] } = setupDesk());
});

it("finds and hovers the region under a page point", () => {
  expect(regionUnder(boardOf(desk, id), iris)).toMatch(/^(iris|pupil)-0$/);
  hoverRegion(boardOf(desk, id), iris);
  expect(useStudio.getState().hover?.boardId).toBe(id);
  hoverRegion(null, iris);
  expect(useStudio.getState().hover).toBeNull();
  useStudio.setState({ desk: null });
  expect(regionUnder(boardOf(desk, id), iris)).toBeNull();
  actOnRegion("jev", boardOf(desk, id), iris);
});

it("Jev decides and paints", () => {
  actOnRegion("jev", boardOf(desk, id), iris);
  expect(desk.state.selection).toEqual([id]);
  expect(controller.requestDecision).toHaveBeenCalledWith(expect.objectContaining({ boardId: id, autoApply: true }));
});

it("paint uses the armed material or opens the library", () => {
  actOnRegion("paint", boardOf(desk, id), iris);
  expect(useStudio.getState().drawer).toBe("materials");
  useStudio.getState().arm("ink-0");
  actOnRegion("paint", boardOf(desk, id), iris);
  expect(controller.applyManual).toHaveBeenCalledWith("ink-0", expect.objectContaining({ boardId: id }));
});

it("pick arms a painted region's material", () => {
  actOnRegion("pick", boardOf(desk, id), iris);
  expect(useStudio.getState().armedMaterial).toBeNull();
  const regionId = regionUnder(boardOf(desk, id), iris)!;
  const board = boardOf(desk, id);
  desk.updateShape(id, { props: { ...board.props, paints: { [regionId]: { m: "lava-0", t: 0 } } } });
  actOnRegion("pick", boardOf(desk, id), iris);
  expect(useStudio.getState().armedMaterial).toBe("lava-0");
  expect(desk.state.tool).toBe("paint");
});
