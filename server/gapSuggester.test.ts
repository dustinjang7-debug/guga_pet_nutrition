import { describe, expect, it } from "vitest";
import { aafcoComparison, recipeMacros, recipeTotals } from "../shared/calc";
import { suggestRemediations, formatGrams } from "../shared/gapSuggester";
import type { AafcoRow } from "../shared/calc";

/**
 * gapSuggester unit tests.
 *
 * We build a deliberately deficient recipe (a small amount of pure rice for an
 * adult dog) and verify the suggester returns:
 *   - actionable suggestions for nutrients that are below AAFCO
 *   - calcium → eggshell powder (id 159) as the additive
 *   - sodium → salt (id 154) as the additive
 *   - fresh suggestions ranked best-density-first
 */

function buildCompareForDeficientDog(): AafcoRow[] {
  // 200g raw white rice (id 1). Almost no calcium, no sodium, no calcium etc.
  const items = [{ ingredientId: 1, grams: 200 }];
  const totals = recipeTotals(items);
  const macros = recipeMacros(items, totals);
  return aafcoComparison(totals, macros, "dog", false);
}

function totalDM(): number {
  const items = [{ ingredientId: 1, grams: 200 }];
  const totals = recipeTotals(items);
  return recipeMacros(items, totals).totalDryMatter_g;
}

describe("gapSuggester.suggestRemediations", () => {
  it("returns at least one gap for a deliberately deficient recipe", () => {
    const rows = buildCompareForDeficientDog();
    const gaps = suggestRemediations(rows, totalDM(), [1]);
    expect(gaps.length).toBeGreaterThan(0);
  });

  it("recommends eggshell powder (id 159) as the calcium additive", () => {
    const rows = buildCompareForDeficientDog();
    const gaps = suggestRemediations(rows, totalDM(), [1]);
    const ca = gaps.find((g) => g.row.nutrient.key === "calcium_mg");
    expect(ca).toBeDefined();
    expect(ca!.additive).not.toBeNull();
    expect(ca!.additive!.ingredient.id).toBe(159);
    // The grams to close the gap should be a small positive number (eggshell powder is dense).
    expect(ca!.additive!.gramsNeeded).toBeGreaterThan(0);
    expect(ca!.additive!.gramsNeeded).toBeLessThan(25.01); // capped at maxGrams=25
  });

  it("recommends salt (id 154) as the sodium additive", () => {
    const rows = buildCompareForDeficientDog();
    const gaps = suggestRemediations(rows, totalDM(), [1]);
    const na = gaps.find((g) => g.row.nutrient.key === "sodium_mg");
    expect(na).toBeDefined();
    expect(na!.additive).not.toBeNull();
    expect(na!.additive!.ingredient.id).toBe(154);
  });

  it("returns top-3 fresh suggestions sorted ascending by gramsNeeded (denser=better)", () => {
    const rows = buildCompareForDeficientDog();
    const gaps = suggestRemediations(rows, totalDM(), [1]);
    const ca = gaps.find((g) => g.row.nutrient.key === "calcium_mg")!;
    expect(ca.fresh.length).toBeGreaterThan(0);
    expect(ca.fresh.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < ca.fresh.length; i++) {
      expect(ca.fresh[i].gramsNeeded).toBeGreaterThanOrEqual(ca.fresh[i - 1].gramsNeeded);
    }
  });

  it("excludes already-in-recipe ingredients from fresh suggestions", () => {
    const rows = buildCompareForDeficientDog();
    const gaps = suggestRemediations(rows, totalDM(), [1, 159]); // exclude eggshell powder too
    const ca = gaps.find((g) => g.row.nutrient.key === "calcium_mg");
    if (ca) {
      expect(ca.fresh.find((f) => f.ingredient.id === 159)).toBeUndefined();
    }
  });

  it("returns no gaps when totalDryMatter is zero (empty recipe)", () => {
    const rows: AafcoRow[] = [];
    const gaps = suggestRemediations(rows, 0, []);
    expect(gaps).toEqual([]);
  });
});

describe("gapSuggester.formatGrams", () => {
  it("rounds 0–1 g to 0.01 precision and floors to 0.10", () => {
    expect(formatGrams(0.05)).toBe("0.10");
    expect(formatGrams(0.4567)).toBe("0.46");
  });
  it("uses 0.01 precision for 1–10 g", () => {
    expect(formatGrams(2.345)).toBe("2.35");
  });
  it("uses 0.1 precision for 10–100 g", () => {
    expect(formatGrams(23.5)).toBe("23.5");
  });
  it("uses 1 g precision for >=100 g", () => {
    expect(formatGrams(345.6)).toBe("346");
  });
  it("returns dash for non-finite", () => {
    expect(formatGrams(Infinity)).toBe("—");
  });
});
