import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NativeError, errorCopy } from "@/components/common/NativeError";
import { JevThinking } from "@/components/JevDecision/JevThinking";
import { ProbabilityField } from "@/components/JevDecision/ProbabilityField";
import { DecisionHistory } from "@/components/JevPanel/DecisionHistory";
import { StructureReadout } from "@/components/JevPanel/StructureReadout";
import { initialStudio, useStudio } from "@/state/studio";
import { MATERIALS, decision } from "@/test/fixtures";

vi.mock("@/state/jevController", () => ({ replay: vi.fn() }));
const controller = await import("@/state/jevController");

const materials = new Map(MATERIALS.map((m) => [m.id, m]));

beforeEach(() => useStudio.setState({ ...initialStudio, materialsById: materials }));

describe("ProbabilityField", () => {
  it("draws the distribution with honest certainty", () => {
    const onPick = vi.fn();
    render(<ProbabilityField decision={decision({ certainty: "uncertain", confidence: 0.2 })} materials={materials} onPick={onPick} />);
    expect(screen.getByText("uncertain field")).toBeInTheDocument();
    expect(screen.getByText("liquid 0")).toBeInTheDocument();
    expect(screen.getByText("0.20")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Apply chrome 0 instead"));
    expect(onPick).toHaveBeenCalledWith("chrome-0");
  });

  it("collapses long fields and shows treatment", () => {
    const ranking = MATERIALS.slice(0, 9).map((m, i) => ({ materialId: m.id, probability: 0.1, rank: i + 1 }));
    render(<ProbabilityField decision={decision({ ranking, treatment: { mode: "duotone", probabilities: { duotone: 0.6 }, confidence: 0.6 } })} materials={materials} />);
    fireEvent.click(screen.getByText("+ 3 more in field"));
    expect(screen.getByText("collapse field")).toBeInTheDocument();
    expect(screen.getByText("duotone")).toBeInTheDocument();
  });
});

describe("panel pieces", () => {
  it("renders structure and thinking states", () => {
    render(<StructureReadout features={{ kind: "iris", label: "iris", areaRatio: 0.1, complexity: 0.5, strokeDensity: 0.3, symmetry: 0.9, composition: "balanced" }} />);
    expect(screen.getByText("0.90")).toBeInTheDocument();
    render(<JevThinking candidates={MATERIALS.slice(0, 4)} model="jev-latest" />);
    expect(screen.getByText("4 candidates · jev-latest")).toBeInTheDocument();
  });

  it("uses native copy for errors", () => {
    render(<NativeError code="jev_unavailable">retry</NativeError>);
    expect(screen.getByRole("alert")).toHaveTextContent("Jev connection interrupted");
    expect(errorCopy("???").title).toBe("Jev connection interrupted");
  });

  it("lists history and replays on click", () => {
    const { rerender } = render(<DecisionHistory />);
    expect(screen.getByText(/No decisions yet/)).toBeInTheDocument();
    useStudio.setState({ history: [{ id: "h", at: Date.now(), boardId: "b", regionId: null, boardTitle: "B", target: "eye", materialId: "ink-0", confidence: 0.71, certainty: "confident", provider: "real" }] });
    rerender(<DecisionHistory />);
    expect(screen.getByText("71%")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Focus the sketch and replay this paint"));
    expect(controller.replay).toHaveBeenCalled();
  });
});
