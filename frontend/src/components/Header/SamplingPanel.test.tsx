import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { SamplingDecor } from "@/components/Canvas/SamplingDecor";
import { useStudio } from "@/state/studio";
import { setupDesk } from "@/test/desk";

import { SamplingPanel } from "./SamplingPanel";

vi.mock("@/state/sampling", async (original) => ({
  ...(await original<typeof import("@/state/sampling")>()),
  buildSampling: vi.fn(() => ["a", "b", "c"]),
  playSampling: vi.fn(async () => undefined),
  rewindSampling: vi.fn(),
  stopSampling: vi.fn(),
}));
const sampling = await import("@/state/sampling");

beforeEach(() => {
  vi.clearAllMocks();
  setupDesk(1);
});

it("sets the sample count and builds the carousel", () => {
  render(<SamplingPanel />);
  fireEvent.click(screen.getByRole("button", { name: "12" }));
  expect(screen.getByText(/Replaces the desk with 12 samples/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Number of samples"), { target: { value: "9" } });
  fireEvent.change(screen.getByLabelText("Sample category"), { target: { value: "animals" } });
  fireEvent.click(screen.getByRole("button", { name: "Build carousel" }));
  expect(sampling.buildSampling).toHaveBeenCalledWith(9, "animals");
  fireEvent.click(screen.getByRole("button", { name: /Play/ }));
  expect(sampling.playSampling).toHaveBeenCalled();
  expect(useStudio.getState().drawer).toBe("none");
});

it("offers rewind and dissolve once a carousel exists", () => {
  useStudio.getState().setSampling({ ids: ["a", "b", "c"], cursor: 1, phase: "ready", landed: 1 });
  render(<SamplingPanel />);
  expect(screen.getByText("1/3 painted")).toBeInTheDocument();
  fireEvent.click(screen.getByTitle("Back to the first sample"));
  fireEvent.click(screen.getByRole("button", { name: "Dissolve" }));
  fireEvent.click(screen.getByRole("button", { name: /Play/ }));
  expect(sampling.rewindSampling).toHaveBeenCalled();
  expect(sampling.stopSampling).toHaveBeenCalled();
  expect(sampling.playSampling).toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("Close sampling"));
});

it("draws the stage, carousel and slot, reflecting the phase", () => {
  const { container, rerender } = render(
    <>
      <SamplingDecor layer="under" />
      <SamplingDecor layer="over" />
    </>,
  );
  expect(container).toBeEmptyDOMElement();
  useStudio.getState().setSampling({ ids: ["a", "b", "c"], cursor: 1, phase: "painting", landed: 1 });
  rerender(<SamplingDecor layer="under" />);
  expect(screen.getByText("JEV PAINTING")).toBeInTheDocument();
  expect(screen.getByText("SAMPLE 02 / 03")).toBeInTheDocument();
  expect(container.querySelector(".es-stage-flash")).not.toBeNull();
  useStudio.getState().patchSampling({ phase: "sliding" });
  rerender(<SamplingDecor layer="under" />);
  expect(container.querySelectorAll(".es-streak").length).toBe(6);
  useStudio.getState().patchSampling({ phase: "done", cursor: 3 });
  rerender(<SamplingDecor layer="over" />);
  expect(container.querySelector("#es-fade-l")).not.toBeNull();
});
