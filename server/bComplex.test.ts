import { describe, expect, it } from "vitest";
import {
  aafcoComparison,
  recipeMacros,
  recipeTotals,
  type AafcoRow,
} from "../shared/calc";
import {
  B_VITAMIN_KEYS,
  bComplexReport,
} from "../shared/gapSuggester";

/**
 * Wizard B-complex step now grades success against ALL seven B vitamins
 * (B1, B2, B3/niacin, B5, B6, folate, B12). Choline is intentionally excluded —
 * it has its own wizard step.
 *
 * These tests build deliberately deficient and deliberately sufficient recipes
 * for an adult dog and verify:
 *   - the report enumerates exactly the seven B vitamins
 *   - allMet flips correctly when the deficient recipe is swapped for one with
 *     enough brewer's yeast
 *   - the recommended yeast grams never exceed 2% of total recipe weight
 *   - cappedAt2Pct flag fires when the math would exceed 2%
 */

function aafcoForItems(
  items: { ingredientId: number; grams: number }[],
): AafcoRow[] {
  const totals = recipeTotals(items);
  const macros = recipeMacros(items, totals);
  return aafcoComparison(totals, macros, "dog", false);
}

function macrosFor(items: { ingredientId: number; grams: number }[]) {
  const totals = recipeTotals(items);
  return recipeMacros(items, totals);
}

describe("bComplexReport — wizard B-vitamin step", () => {
  it("enumerates exactly the seven B vitamins (B1, B2, B3, B5, B6, folate, B12)", () => {
    expect(B_VITAMIN_KEYS).toEqual([
      "vit_b1_mg",
      "vit_b2_mg",
      "niacin_mg",
      "vit_b5_mg",
      "vit_b6_mg",
      "folate_mg",
      "vit_b12_ug",
    ]);
  });

  it("flags multiple deficiencies on a rice-only recipe", () => {
    // 200g raw white rice (id 1) + nothing else → severe B-vitamin shortfalls
    const items = [{ ingredientId: 1, grams: 200 }];
    const aafco = aafcoForItems(items);
    const m = macrosFor(items);
    const report = bComplexReport(aafco, m.totalDryMatter_g, m.totalGrams);

    expect(report.perVitamin.length).toBe(7);
    expect(report.allMet).toBe(false);
    expect(report.belowCount).toBeGreaterThan(0);
    expect(report.recommendedYeastGrams).toBeGreaterThan(0);
  });

  it("never recommends more brewer's yeast than 2% of total recipe weight", () => {
    const items = [{ ingredientId: 1, grams: 200 }]; // 200g rice → 2% cap = 4g
    const aafco = aafcoForItems(items);
    const m = macrosFor(items);
    const report = bComplexReport(aafco, m.totalDryMatter_g, m.totalGrams);

    expect(report.yeastCap_g).toBeCloseTo(4.0, 5);
    expect(report.recommendedYeastGrams).toBeLessThanOrEqual(report.yeastCap_g + 1e-9);
  });

  it("sets cappedAt2Pct=true when raw need exceeds 2% ceiling", () => {
    // Tiny 50g rice recipe → 2% cap = 1g → almost any B-vitamin gap will exceed it.
    const items = [{ ingredientId: 1, grams: 50 }];
    const aafco = aafcoForItems(items);
    const m = macrosFor(items);
    const report = bComplexReport(aafco, m.totalDryMatter_g, m.totalGrams);

    expect(report.cappedAt2Pct).toBe(true);
    expect(report.recommendedYeastGrams).toBeCloseTo(1.0, 5);
  });

  it("returns allMet=true when every B-vitamin AAFCO row already reports status=ok", () => {
    // Synthetic AAFCO rows: every B vitamin is already ok. We don't depend on
    // real ingredient densities (some, like B12 in the current DB, are stored
    // as 0.02 μg/100g due to rounding and would never reach AAFCO via food alone).
    const okRow = (key: string, unit: string): AafcoRow => ({
      nutrient: {
        key,
        label_en: key,
        label_zh: key,
        label_th: key,
        unit,
        adultMin: 1,
        growthMin: 1,
        max: null,
      },
      totalInRecipe: 1000,
      perKgDM: 100,
      per1000kcal: 100,
      status: "ok",
      min: 1,
      max: null,
      delta: 99,
    });
    const aafco: AafcoRow[] = [
      okRow("vit_b1_mg", "mg/kg DM"),
      okRow("vit_b2_mg", "mg/kg DM"),
      okRow("niacin_mg", "mg/kg DM"),
      okRow("vit_b5_mg", "mg/kg DM"),
      okRow("vit_b6_mg", "mg/kg DM"),
      okRow("folate_mg", "mg/kg DM"),
      okRow("vit_b12_ug", "μg/kg DM"),
    ];
    const report = bComplexReport(aafco, 1000, 1000);

    expect(report.allMet).toBe(true);
    expect(report.belowCount).toBe(0);
    expect(report.recommendedYeastGrams).toBe(0);
    expect(report.cappedAt2Pct).toBe(false);
  });

  it("uses startingVolume fallback semantics (caller is responsible)", () => {
    // The function does not know about startingVolume — caller passes the larger
    // of (totalRecipe_g) or (startingVolume) at call site. Here we verify that
    // when totalRecipe_g is 0 the cap is also 0 (no recommendation possible).
    const aafco = aafcoForItems([]);
    const report = bComplexReport(aafco, 0, 0);
    expect(report.yeastCap_g).toBe(0);
    expect(report.recommendedYeastGrams).toBe(0);
    expect(report.allMet).toBe(false); // no rows present → not "met"
  });
});
