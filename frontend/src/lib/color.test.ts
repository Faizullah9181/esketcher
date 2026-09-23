import { describe, expect, it } from "vitest";

import { harmony, hexToRgb, hsl, isNeutral, luminance, mix, rgba, rgbToHex, shiftHue } from "./color";

describe("color", () => {
  it("round-trips hex", () => {
    expect(hexToRgb("#ff8000")).toEqual([255, 128, 0]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(rgbToHex([255, 128, 0])).toBe("#ff8000");
    expect(rgbToHex([300, -5, 0])).toBe("#ff0000");
  });

  it("mixes and formats", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(rgba("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("rotates hue", () => {
    expect(shiftHue("#ff0000", 120)).toBe("#00ff00");
    expect(shiftHue("#ff0000", 240)).toBe("#0000ff");
    expect(shiftHue("#808080", 90)).toBe("#808080");
    expect(shiftHue("#00ff00", 360)).toBe("#00ff00");
    for (const deg of [30, 90, 150, 210, 270, 330]) expect(shiftHue("#ff0000", deg)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("orders luminance", () => {
    expect(luminance("#ffffff")).toBeGreaterThan(luminance("#777777"));
    expect(luminance("#000000")).toBe(0);
  });
});

describe("harmony", () => {
  it("matches the backend scale", () => {
    expect(hsl("#00ff00").h).toBeCloseTo(120);
    expect(hsl("#0000ff").h).toBeCloseTo(240);
    expect(isNeutral("#808080")).toBe(true);
    expect(harmony("#ff0000", "#ff4000")).toBe(1);
    expect(harmony("#ff0000", "#00ffff")).toBe(0.7);
    expect(harmony("#ff0000", "#00ff00")).toBe(0.4);
    expect(harmony("#ff0000", "#ffff00")).toBe(-0.6);
    expect(harmony("#ff0000", "#808080")).toBe(0);
  });
});
