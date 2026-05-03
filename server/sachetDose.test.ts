import { describe, expect, it } from "vitest";
import { computeSachetDose, premixGramsForRecipe } from "@shared/sachetDose";

describe("computeSachetDose", () => {
  it("rejects below 2 kg", () => {
    expect(computeSachetDose(1.9)).toEqual({ ok: false, reason: "below_min" });
    expect(computeSachetDose(0)).toEqual({ ok: false, reason: "below_min" });
  });

  it("rejects above 40 kg", () => {
    expect(computeSachetDose(40.1)).toEqual({ ok: false, reason: "above_max" });
    expect(computeSachetDose(100)).toEqual({ ok: false, reason: "above_max" });
  });

  it("returns 1 sachet for 2.0 kg lower bound", () => {
    expect(computeSachetDose(2.0)).toEqual({ ok: true, sachets: 1, gramsPerDay: 5 });
  });

  it("returns 1 sachet at 7.4 kg upper end of 1-sachet range", () => {
    expect(computeSachetDose(7.4)).toEqual({ ok: true, sachets: 1, gramsPerDay: 5 });
  });

  it("bumps to 2 sachets exactly at 7.5 kg midpoint", () => {
    expect(computeSachetDose(7.5)).toEqual({ ok: true, sachets: 2, gramsPerDay: 10 });
  });

  it("returns 2 sachets through 12.4 kg", () => {
    expect(computeSachetDose(12.4)).toEqual({ ok: true, sachets: 2, gramsPerDay: 10 });
  });

  it("bumps to 3 at 12.5 kg", () => {
    expect(computeSachetDose(12.5)).toEqual({ ok: true, sachets: 3, gramsPerDay: 15 });
  });

  it("returns 8 sachets at 40 kg max", () => {
    expect(computeSachetDose(40.0)).toEqual({ ok: true, sachets: 8, gramsPerDay: 40 });
  });

  it("returns 7 sachets at 37.4 kg, 8 at 37.5 kg", () => {
    expect(computeSachetDose(37.4).ok && computeSachetDose(37.4)).toMatchObject({
      sachets: 7,
    });
    expect(computeSachetDose(37.5).ok && computeSachetDose(37.5)).toMatchObject({
      sachets: 8,
    });
  });

  it("rejects NaN gracefully", () => {
    expect(computeSachetDose(NaN)).toEqual({ ok: false, reason: "below_min" });
  });
});

describe("premixGramsForRecipe", () => {
  it("multiplies daily dose by recipe days", () => {
    // 5 kg cat → 1 sachet/day × 5 g × 7 days = 35 g
    expect(premixGramsForRecipe(5, 7)).toBe(35);
    // 10 kg dog → 2 sachets/day × 5 g × 3 days = 30 g
    expect(premixGramsForRecipe(10, 3)).toBe(30);
  });

  it("returns 0 for out-of-range weights", () => {
    expect(premixGramsForRecipe(1, 5)).toBe(0);
    expect(premixGramsForRecipe(50, 5)).toBe(0);
  });

  it("clamps recipe days to >= 1", () => {
    expect(premixGramsForRecipe(5, 0)).toBe(5); // still 1 day
    expect(premixGramsForRecipe(5, -3)).toBe(5);
  });
});
