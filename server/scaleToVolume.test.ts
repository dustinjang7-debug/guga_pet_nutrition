import { describe, expect, it } from "vitest";
import { scaleToVolume } from "@shared/scaleToVolume";

const item = (id: number, grams: number) => ({ ingredientId: id, grams });

describe("scaleToVolume", () => {
  it("rescales total to target preserving ratios", () => {
    const out = scaleToVolume([item(1, 200), item(2, 300), item(3, 500)], 1000);
    const total = out.reduce((s, i) => s + i.grams, 0);
    expect(total).toBeCloseTo(1000, 6);
    // Same as input — ratios already at target → unchanged
    expect(out[0].grams).toBeCloseTo(200);
    expect(out[1].grams).toBeCloseTo(300);
    expect(out[2].grams).toBeCloseTo(500);
  });

  it("scales up small recipes", () => {
    const out = scaleToVolume([item(1, 100), item(2, 100)], 1000);
    expect(out[0].grams).toBeCloseTo(500);
    expect(out[1].grams).toBeCloseTo(500);
  });

  it("scales down oversized recipes", () => {
    const out = scaleToVolume([item(1, 1500), item(2, 500)], 1000);
    expect(out[0].grams).toBeCloseTo(750);
    expect(out[1].grams).toBeCloseTo(250);
  });

  it("preserves ingredientId and any extra fields", () => {
    const out = scaleToVolume([item(42, 250)], 1000);
    expect(out[0].ingredientId).toBe(42);
  });

  it("returns input unchanged when empty", () => {
    expect(scaleToVolume([], 1000)).toEqual([]);
  });

  it("returns input unchanged when total is zero", () => {
    const input = [item(1, 0), item(2, 0)];
    expect(scaleToVolume(input, 1000)).toEqual(input);
  });

  it("returns input unchanged when target is zero or negative", () => {
    const input = [item(1, 100)];
    expect(scaleToVolume(input, 0)).toEqual(input);
    expect(scaleToVolume(input, -50)).toEqual(input);
  });
});
