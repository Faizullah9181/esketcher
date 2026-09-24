import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmptyState } from "@/components/Canvas/EmptyState";
import { ExperimentsPanel } from "@/components/Header/ExperimentsPanel";
import { Header } from "@/components/Header/Header";
import { JevPanel } from "@/components/JevPanel/JevPanel";
import { MaterialLibrary } from "@/components/MaterialRail/MaterialLibrary";
import { SketchGallery } from "@/components/SketchGallery/SketchGallery";
import { Toolbar } from "@/components/Toolbar/Toolbar";
import { SimulationControls, SimulationHud } from "@/components/Header/SimulationControls";
import { DecisionPill } from "@/components/JevDecision/DecisionPill";
import type { Desk } from "@/lib/desk/desk";
import { useStudio, type ActiveDecision } from "@/state/studio";
import { boardOf, setupDesk } from "@/test/desk";
import { decision } from "@/test/fixtures";

vi.mock("@/state/simulation", () => ({ startSimulation: vi.fn(async () => undefined), pauseSimulation: vi.fn(), stopSimulation: vi.fn() }));
const simulation = await import("@/state/simulation");
vi.mock("@/state/sampling", async (original) => ({ ...(await original<typeof import("@/state/sampling")>()), playSampling: vi.fn(async () => undefined), pauseSampling: vi.fn(), stopSampling: vi.fn() }));
const samplingModule = await import("@/state/sampling");

vi.mock("@/state/jevController", () => ({
  applyActive: vi.fn(),
  applyManual: vi.fn(() => false),
  cancelDecision: vi.fn(),
  replay: vi.fn(),
  requestDecision: vi.fn(),
  retryDecision: vi.fn(),
}));
const controller = await import("@/state/jevController");

let BOARD: string;
let desk: Desk;

beforeEach(() => {
  vi.clearAllMocks();
  let ids: string[];
  ({ desk, ids } = setupDesk(2));
  BOARD = ids[0];
  useStudio.getState().setHealth({ status: "ok", version: "0.1.0", jev: { mode: "real", model: "jev-latest", online: true, latencyMs: 300, availableModels: [], error: null } });
});

describe("Header", () => {
  it("shows state, drives the desk and switches views", () => {
    desk.select([BOARD]);
    desk.updateShape(BOARD, { x: 5 });
    useStudio.getState().setSave("saved");
    render(<Header />);
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText(/online · real/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Undo"));
    expect(desk.getShape(BOARD)?.x).toBe(0);
    fireEvent.click(screen.getByLabelText("Redo"));
    expect(desk.getShape(BOARD)?.x).toBe(5);
    fireEvent.click(screen.getByTitle("Reset zoom"));
    fireEvent.click(screen.getByLabelText("Next sketch"));
    fireEvent.click(screen.getByLabelText("Previous sketch"));
    expect(desk.state.selection).toHaveLength(1);
    fireEvent.click(screen.getByText("Sketches"));
    expect(useStudio.getState().drawer).toBe("sketches");
    fireEvent.click(screen.getByText("Universe"));
    expect(useStudio.getState().drawer).toBe("none");
    fireEvent.click(screen.getByLabelText("Toggle Jev panel"));
    expect(useStudio.getState().panelOpen).toBe(true);
  });

  it("starts fresh after confirming, and can be undone", () => {
    vi.mocked(simulation.stopSimulation).mockClear();
    render(<Header />);
    fireEvent.click(screen.getByTitle("Clear the desk and start from an empty canvas"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(desk.getShapes()).toHaveLength(2);
    fireEvent.click(screen.getByTitle("Clear the desk and start from an empty canvas"));
    expect(screen.getByRole("dialog", { name: "Start fresh" })).toHaveTextContent("Clear all 2 items");
    fireEvent.click(screen.getByRole("button", { name: "Start fresh" }));
    expect(desk.getShapes()).toHaveLength(0);
    expect(simulation.stopSimulation).toHaveBeenCalled();
    expect(screen.getByTitle("Clear the desk and start from an empty canvas")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Undo"));
    expect(desk.getShapes()).toHaveLength(2);
  });

  it("warns when offline", () => {
    useStudio.getState().setSave("offline");
    useStudio.getState().setHealth(null, "network");
    render(<Header />);
    expect(screen.getByText("offline")).toBeInTheDocument();
    expect(screen.getByText("no sketch")).toBeInTheDocument();
  });
});

describe("Views menu (narrow screens)", () => {
  it("opens views and Fresh from one menu", () => {
    render(<Header />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Materials" }));
    expect(useStudio.getState().drawer).toBe("materials");
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByLabelText("Open menu"));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByLabelText("Open menu"));
    const menu = screen.getByRole("menu");
    fireEvent.click(within(menu).getByTitle("Clear the desk and start from an empty canvas"));
    fireEvent.click(within(menu).getByRole("button", { name: "Start fresh" }));
    expect(desk.getShapes()).toHaveLength(0);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByLabelText("Open menu"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sampling" }));
    expect(useStudio.getState().drawer).toBe("sampling");
  });

  it("has a Sampling tab beside Fresh that shows when a carousel is live", () => {
    useStudio.getState().setSampling({ ids: [], cursor: 0, phase: "ready", landed: 0 });
    render(<Header />);
    const tab = screen.getAllByRole("button", { name: "Sampling" })[0];
    expect(tab.querySelector(".es-dot--live")).not.toBeNull();
    fireEvent.click(tab);
    expect(useStudio.getState().drawer).toBe("sampling");
  });
});

describe("Decision pill (phones and tablets)", () => {
  const ready = (overrides = {}) => ({ key: "k", boardId: BOARD, regionId: null, scope: "sketch" as const, status: "ready" as const, features: {} as never, candidates: [], rejected: [], attempt: 1, autoApply: false, startedAt: 0, decision: decision(), ...overrides });

  it("summarises the answer and applies it", () => {
    const { rerender, container } = render(<DecisionPill />);
    expect(container).toBeEmptyDOMElement();
    useStudio.setState({ active: ready({ status: "analyzing", decision: undefined }) });
    rerender(<DecisionPill />);
    expect(screen.getByText(/evaluating material field/)).toBeInTheDocument();
    useStudio.setState({ active: ready() });
    rerender(<DecisionPill />);
    expect(screen.getByText("liquid 0")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(controller.applyActive).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Open Jev panel"));
    expect(useStudio.getState().panelOpen).toBe(true);
    rerender(<DecisionPill />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows interruptions and hides during Play", () => {
    useStudio.setState({ active: ready({ status: "error", decision: undefined }) });
    const { rerender, container } = render(<DecisionPill />);
    expect(screen.getByText(/jev interrupted/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Show Jev's field"));
    expect(useStudio.getState().panelOpen).toBe(true);
    useStudio.setState({ panelOpen: false });
    useStudio.getState().setSim({ status: "running" });
    rerender(<DecisionPill />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Simulation controls", () => {
  it("plays, pauses, resumes and stops", () => {
    const { rerender } = render(<SimulationControls />);
    fireEvent.click(screen.getByLabelText("Play"));
    expect(simulation.startSimulation).toHaveBeenCalled();
    useStudio.getState().setSim({ status: "running", done: 3, total: 10, current: "01 · Board 1 / iris" });
    rerender(<SimulationControls />);
    expect(screen.getByText("3/10")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Pause"));
    expect(simulation.pauseSimulation).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Stop simulation"));
    expect(simulation.stopSimulation).toHaveBeenCalled();
    useStudio.getState().setSim({ status: "error", error: "Jev is down" });
    rerender(<SimulationControls />);
    expect(screen.getByLabelText("Resume")).toBeInTheDocument();
  });

  it("drives the carousel instead of the desk once one is built", () => {
    useStudio.getState().setSampling({ ids: ["a"], cursor: 0, phase: "ready", landed: 0 });
    useStudio.setState({ drawer: "sampling" });
    const { rerender } = render(<SimulationControls />);
    fireEvent.click(screen.getByLabelText("Play"));
    expect(samplingModule.playSampling).toHaveBeenCalled();
    expect(useStudio.getState().drawer).toBe("none");
    useStudio.getState().setSim({ status: "running", total: 1 });
    rerender(<SimulationControls />);
    fireEvent.click(screen.getByLabelText("Pause"));
    fireEvent.click(screen.getByLabelText("Stop simulation"));
    expect(samplingModule.pauseSampling).toHaveBeenCalled();
    expect(samplingModule.stopSampling).toHaveBeenCalled();
    render(<SimulationHud />);
    expect(screen.getByText("sampling · 1/1")).toBeInTheDocument();
  });

  it("narrates the run over the canvas", () => {
    const { rerender, container } = render(<SimulationHud />);
    expect(container).toBeEmptyDOMElement();
    useStudio.getState().setSim({ status: "running", done: 3, total: 10, current: "01 · Board 1 / iris" });
    rerender(<SimulationHud />);
    expect(screen.getByText("simulating · 4/10")).toBeInTheDocument();
    expect(screen.getByText("01 · Board 1 / iris")).toBeInTheDocument();
    useStudio.getState().setSim({ status: "error", error: "Jev is down" });
    rerender(<SimulationHud />);
    expect(screen.getByText("Jev is down")).toBeInTheDocument();
    useStudio.getState().setSim({ status: "done" });
    rerender(<SimulationHud />);
    expect(screen.getByText("desk filled")).toBeInTheDocument();
  });
});

describe("Toolbar", () => {
  it("switches tools, duplicates and opens the library", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByLabelText("Pen"));
    expect(desk.state.tool).toBe("draw");
    fireEvent.click(screen.getByLabelText(/Jev: click anything/));
    expect(desk.state.tool).toBe("jev");
    fireEvent.click(screen.getByLabelText("Duplicate"));
    expect(desk.getShapes()).toHaveLength(2);
    desk.select([BOARD]);
    fireEvent.click(screen.getByLabelText("Duplicate"));
    expect(desk.getShapes()).toHaveLength(3);
    fireEvent.click(screen.getByLabelText("New sketch board"));
    expect(useStudio.getState().drawer).toBe("sketches");
  });
});

describe("JevPanel", () => {
  const active = (overrides: Partial<ActiveDecision>): ActiveDecision => ({
    key: `${BOARD}|*`,
    boardId: BOARD,
    regionId: null,
    scope: "sketch",
    status: "ready",
    features: { kind: "board", label: "whole sketch", areaRatio: 1, complexity: 0.6, strokeDensity: 0.4, symmetry: 0.9, composition: "balanced" },
    candidates: ["liquid-0", "chrome-0", "ink-0"],
    rejected: [],
    attempt: 1,
    autoApply: false,
    startedAt: 0,
    ...overrides,
  });

  it("idles with real stats", () => {
    render(<JevPanel />);
    expect(screen.getByText("a material.")).toBeInTheDocument();
    expect(screen.getByText("real · jev-latest")).toBeInTheDocument();
  });

  it("shows the board's palette direction", () => {
    useStudio.setState({ focus: { boardId: BOARD, regionId: null }, palettes: [{ id: "royal-jewel", name: "Royal jewel", families: ["royal", "spectral", "unknown"], description: "violet and gold" }] });
    desk.updateShape(BOARD, { props: { ...boardOf(desk, BOARD).props, palette: "royal-jewel" } });
    render(<JevPanel />);
    expect(screen.getByText("Royal jewel")).toBeInTheDocument();
    expect(screen.getByTitle("violet and gold")).toBeInTheDocument();
  });

  it("asks Jev for a focused board", () => {
    useStudio.setState({ focus: { boardId: BOARD, regionId: null } });
    render(<JevPanel />);
    fireEvent.click(screen.getByText("Ask Jev"));
    expect(controller.requestDecision).toHaveBeenCalledWith({ boardId: BOARD, regionId: null, autoApply: false });
    fireEvent.click(screen.getByText("iris"));
    expect(useStudio.getState().focus?.regionId).toBe("iris-0");
  });

  it("shows the thinking state", () => {
    useStudio.setState({ focus: { boardId: BOARD, regionId: null }, active: active({ status: "analyzing" }) });
    render(<JevPanel />);
    expect(screen.getByText("evaluating material field")).toBeInTheDocument();
  });

  it("offers apply, retry, manual pick and locks on a decision", () => {
    useStudio.setState({ focus: { boardId: BOARD, regionId: null }, active: active({ decision: decision() }) });
    render(<JevPanel />);
    fireEvent.click(screen.getByText(/^Apply · /));
    expect(controller.applyActive).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Try another"));
    expect(controller.retryDecision).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Pick manually"));
    fireEvent.click(screen.getByTitle("chrome 0"));
    expect(controller.applyManual).toHaveBeenCalledWith("chrome-0", { boardId: BOARD, regionId: null });
    fireEvent.click(screen.getByTitle("Always paint this sketch with this material"));
    expect(boardOf(desk, BOARD).props.lockedMaterial).toBe("liquid-0");
    fireEvent.click(screen.getByTitle("Lock the sketch against edits and painting"));
    expect(boardOf(desk, BOARD).locked).toBe(true);
    fireEvent.click(screen.getByTitle("Undo"));
    expect(boardOf(desk, BOARD).locked).toBe(false);
  });

  it("says 'apply anyway' when uncertain, and explains locks", () => {
    useStudio.setState({ focus: { boardId: BOARD, regionId: null }, active: active({ decision: decision({ certainty: "uncertain", confidence: 0.2 }) }) });
    const { unmount } = render(<JevPanel />);
    expect(screen.getByText(/Apply anyway/)).toBeInTheDocument();
    unmount();
    desk.updateShape(BOARD, { props: { ...boardOf(desk, BOARD).props, lockedMaterial: "lava-0" } });
    render(<JevPanel />);
    expect(screen.getByText(/Jev is bypassed/)).toBeInTheDocument();
  });

  it("never blocks on errors", () => {
    useStudio.setState({ focus: { boardId: BOARD, regionId: null }, active: active({ status: "error", error: { code: "jev_timeout", message: "slow" } }) });
    render(<JevPanel />);
    expect(screen.getByText("Jev took too long")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    fireEvent.click(screen.getByText("Continue manually"));
    expect(screen.getByText("choose manually")).toBeInTheDocument();
    desk.select([BOARD]);
    fireEvent.click(screen.getByLabelText("Clear selection"));
    expect(desk.state.selection).toEqual([]);
  });
});

describe("drawers", () => {
  it("places sketches from the library", () => {
    render(<SketchGallery />);
    fireEvent.change(screen.getByPlaceholderText("search title or tag"), { target: { value: "koi" } });
    fireEvent.click(screen.getByTitle("Add “Koi” to the desk"));
    expect(desk.getShapes()).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "animals" }));
    fireEvent.click(screen.getByLabelText("Close library"));
    expect(useStudio.getState().drawer).toBe("sketches");
  });

  it("arms and pins materials", () => {
    render(<MaterialLibrary />);
    fireEvent.click(screen.getByText("chrome"));
    fireEvent.click(screen.getByTitle(/^chrome 0:/));
    expect(useStudio.getState().armedMaterial).toBe("chrome-0");
    fireEvent.click(screen.getByLabelText("Pin chrome 0 to Jev's field"));
    expect(useStudio.getState().pinned).toEqual(["chrome-0"]);
    fireEvent.click(screen.getByText("all"));
    fireEvent.click(screen.getByLabelText("Close materials"));
  });

  it("tunes experiments", () => {
    render(<ExperimentsPanel />);
    fireEvent.click(screen.getByText("Chaos mode"));
    expect(useStudio.getState().chaos).toBe(true);
    fireEvent.change(screen.getByLabelText("Candidate field size"), { target: { value: "6" } });
    expect(useStudio.getState().candidateCount).toBe(6);
    fireEvent.click(screen.getByLabelText("always"));
    expect(useStudio.getState().autoApplyMin).toBe("uncertain");
    fireEvent.click(screen.getByLabelText("Close experiments"));
  });

  it("invites from the empty state", async () => {
    vi.useFakeTimers();
    render(<EmptyState />);
    expect(screen.getByText("Your canvas is empty.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Create sketch"));
    expect(useStudio.getState().drawer).toBe("sketches");
    fireEvent.click(screen.getByText("Let Jev choose"));
    await vi.advanceTimersByTimeAsync(800);
    expect(controller.requestDecision).toHaveBeenCalledWith(expect.objectContaining({ autoApply: true, regionId: null }));
    vi.useRealTimers();
  });
});
