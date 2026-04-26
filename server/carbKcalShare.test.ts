/**
 * Vitest contract for carbKcalShare(): the kcal-share gate the wizard uses on
 * the carb step. The bands are user-specified:
 *   Dog: optimal 20–30%, ok 30–40%, alert <20% or >40%
 *   Cat: optimal 0–10%, ok 10–20%, alert ≥20% (no alert_low)
 *
 * The function only reads `carb_g` and `energy_kcal` from totals; we build
 * minimal NutrientTotals fixtures here.
 */
import { describe, expect, it } from "vitest";
import { carbKcalShare, type NutrientTotals } from "../shared/calc";

function makeTotals(carb_g: number, energy_kcal: number): NutrientTotals {
  // Most fields aren't read by carbKcalShare — fill with zeros to satisfy types.
  return {
    moisture_g: 0,
    energy_kcal,
    cholesterol_mg: 0,
    protein_g: 0,
    fat_g: 0,
    carb_g,
    fiber_g: 0,
    vitA_ug_RAE: 0,
    vitB1_mg: 0,
    vitB2_mg: 0,
    vitB3_mg: 0,
    vitB5_mg: 0,
    vitB6_mg: 0,
    vitB12_ug: 0,
    vitC_mg: 0,
    vitD_iu: 0,
    vitE_mg: 0,
    vitK_ug: 0,
    choline_mg: 0,
    calcium_mg: 0,
    phosphorus_mg: 0,
    potassium_mg: 0,
    sodium_mg: 0,
    magnesium_mg: 0,
    iron_mg: 0,
    zinc_mg: 0,
    copper_mg: 0,
    manganese_mg: 0,
    selenium_ug: 0,
    iodine_ug: 0,
  } as NutrientTotals;
}

describe("carbKcalShare — dog bands (20-30 optimal, 30-40 ok)", () => {
  it("returns 'empty' when total_kcal is 0", () => {
    const r = carbKcalShare(makeTotals(0, 0), "dog");
    expect(r.status).toBe("empty");
    expect(r.pct).toBe(0);
  });

  it("flags 'alert_low' below 20% kcal share", () => {
    // 25g carb × 4 = 100 kcal. total = 1000 → 10%
    const r = carbKcalShare(makeTotals(25, 1000), "dog");
    expect(r.pct).toBeCloseTo(10, 1);
    expect(r.status).toBe("alert_low");
  });

  it("flags 'optimal' inside 20-30%", () => {
    // 60g × 4 = 240 kcal of 1000 → 24%
    const r = carbKcalShare(makeTotals(60, 1000), "dog");
    expect(r.pct).toBeCloseTo(24, 1);
    expect(r.status).toBe("optimal");
  });

  it("flags 'ok' inside 30-40%", () => {
    // 87.5g × 4 = 350 kcal of 1000 → 35%
    const r = carbKcalShare(makeTotals(87.5, 1000), "dog");
    expect(r.pct).toBeCloseTo(35, 1);
    expect(r.status).toBe("ok");
  });

  it("flags 'alert_high' above 40%", () => {
    // 125g × 4 = 500 of 1000 → 50%
    const r = carbKcalShare(makeTotals(125, 1000), "dog");
    expect(r.pct).toBeCloseTo(50, 1);
    expect(r.status).toBe("alert_high");
  });

  it("hits boundary 20% as 'optimal' (inclusive lower bound)", () => {
    // 50g × 4 = 200 of 1000 → exactly 20%
    const r = carbKcalShare(makeTotals(50, 1000), "dog");
    expect(r.pct).toBeCloseTo(20, 2);
    expect(r.status).toBe("optimal");
  });

  it("hits boundary 30% as 'optimal' (inclusive upper bound)", () => {
    const r = carbKcalShare(makeTotals(75, 1000), "dog");
    expect(r.pct).toBeCloseTo(30, 2);
    expect(r.status).toBe("optimal");
  });

  it("hits boundary 40% as 'ok' (inclusive upper)", () => {
    const r = carbKcalShare(makeTotals(100, 1000), "dog");
    expect(r.pct).toBeCloseTo(40, 2);
    expect(r.status).toBe("ok");
  });
});

describe("carbKcalShare — cat bands (0-10 optimal, 10-20 ok, no alert_low)", () => {
  it("returns 'empty' when total_kcal is 0", () => {
    const r = carbKcalShare(makeTotals(0, 0), "cat");
    expect(r.status).toBe("empty");
  });

  it("flags 'optimal' below 10% (e.g. 5%)", () => {
    // 12.5g × 4 = 50 of 1000 → 5%
    const r = carbKcalShare(makeTotals(12.5, 1000), "cat");
    expect(r.pct).toBeCloseTo(5, 1);
    expect(r.status).toBe("optimal");
  });

  it("flags 'optimal' at 0% (no alert_low for cats)", () => {
    const r = carbKcalShare(makeTotals(0, 1000), "cat");
    expect(r.pct).toBe(0);
    expect(r.status).toBe("optimal");
  });

  it("flags 'optimal' at boundary 10%", () => {
    const r = carbKcalShare(makeTotals(25, 1000), "cat");
    expect(r.pct).toBeCloseTo(10, 1);
    expect(r.status).toBe("optimal");
  });

  it("flags 'ok' inside 10-20%", () => {
    // 37.5g × 4 = 150 of 1000 → 15%
    const r = carbKcalShare(makeTotals(37.5, 1000), "cat");
    expect(r.pct).toBeCloseTo(15, 1);
    expect(r.status).toBe("ok");
  });

  it("flags 'ok' at boundary 20%", () => {
    const r = carbKcalShare(makeTotals(50, 1000), "cat");
    expect(r.pct).toBeCloseTo(20, 1);
    expect(r.status).toBe("ok");
  });

  it("flags 'alert_high' above 20% (e.g. 25%)", () => {
    // 62.5g × 4 = 250 of 1000 → 25%
    const r = carbKcalShare(makeTotals(62.5, 1000), "cat");
    expect(r.pct).toBeCloseTo(25, 1);
    expect(r.status).toBe("alert_high");
  });
});

describe("carbKcalShare — band metadata exposed for UI", () => {
  it("dog returns full band quartet", () => {
    const r = carbKcalShare(makeTotals(50, 1000), "dog");
    expect(r.optimalMin).toBe(20);
    expect(r.optimalMax).toBe(30);
    expect(r.okMin).toBe(30);
    expect(r.okMax).toBe(40);
  });

  it("cat returns full band quartet", () => {
    const r = carbKcalShare(makeTotals(20, 1000), "cat");
    expect(r.optimalMin).toBe(0);
    expect(r.optimalMax).toBe(10);
    expect(r.okMin).toBe(10);
    expect(r.okMax).toBe(20);
  });
});
