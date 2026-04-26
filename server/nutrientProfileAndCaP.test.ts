import { describe, expect, it } from "vitest";
import {
  caPhosphorusRatio,
  nutrientProfile,
  recipeMacros,
  recipeTotals,
  type NutrientTotals,
  type RecipeItem,
} from "@shared/calc";

const CHICKEN_BREAST = 65;
const RICE_WHITE = 1;

function totalsFromMix(): NutrientTotals {
  const items: RecipeItem[] = [
    { ingredientId: CHICKEN_BREAST, grams: 500 },
    { ingredientId: RICE_WHITE, grams: 200 },
  ];
  return recipeTotals(items);
}

describe("caPhosphorusRatio", () => {
  it("returns status=empty when totals have zero Ca or P", () => {
    const empty = recipeTotals([]);
    const r = caPhosphorusRatio(empty, "dog", false);
    expect(r.status).toBe("empty");
    expect(r.ratio).toBe(0);
  });

  it("classifies a perfect 1.3:1 ratio as golden", () => {
    const totals = recipeTotals([]);
    totals.calcium_mg = 1300;
    totals.phosphorus_mg = 1000;
    const r = caPhosphorusRatio(totals, "dog", false);
    expect(r.ratio).toBeCloseTo(1.3, 5);
    expect(r.status).toBe("golden");
  });

  it("classifies 1.1:1 (inside AAFCO, outside golden) as ok", () => {
    const totals = recipeTotals([]);
    totals.calcium_mg = 1100;
    totals.phosphorus_mg = 1000;
    const r = caPhosphorusRatio(totals, "dog", false);
    expect(r.status).toBe("ok");
  });

  it("classifies 0.7:1 as low (below AAFCO min for adult dog 1.0)", () => {
    const totals = recipeTotals([]);
    totals.calcium_mg = 700;
    totals.phosphorus_mg = 1000;
    const r = caPhosphorusRatio(totals, "dog", false);
    expect(r.status).toBe("low");
  });

  it("classifies 2.5:1 as high (above AAFCO max)", () => {
    const totals = recipeTotals([]);
    totals.calcium_mg = 2500;
    totals.phosphorus_mg = 1000;
    const r = caPhosphorusRatio(totals, "dog", false);
    expect(r.status).toBe("high");
  });

  it("growth dog uses tighter upper bound (1.8) so 1.9:1 is high", () => {
    const totals = recipeTotals([]);
    totals.calcium_mg = 1900;
    totals.phosphorus_mg = 1000;
    const adult = caPhosphorusRatio(totals, "dog", false);
    const growth = caPhosphorusRatio(totals, "dog", true);
    expect(adult.status).toBe("ok"); // <= 2.0 for adult
    expect(growth.status).toBe("high"); // > 1.8 for growth
  });

  it("cat has aafcoMin 0.9 (so 0.95:1 is ok, 0.85:1 is low)", () => {
    const ok = recipeTotals([]); ok.calcium_mg = 950; ok.phosphorus_mg = 1000;
    const low = recipeTotals([]); low.calcium_mg = 850; low.phosphorus_mg = 1000;
    expect(caPhosphorusRatio(ok, "cat", false).status).toBe("ok");
    expect(caPhosphorusRatio(low, "cat", false).status).toBe("low");
  });
});

describe("nutrientProfile", () => {
  it("returns one row per catalog entry", () => {
    const totals = totalsFromMix();
    const macros = recipeMacros(
      [
        { ingredientId: CHICKEN_BREAST, grams: 500 },
        { ingredientId: RICE_WHITE, grams: 200 },
      ],
      totals,
    );
    const rows = nutrientProfile(totals, macros);
    expect(rows.length).toBeGreaterThanOrEqual(28); // every Ingredient nutrient column
  });

  it("totals row matches recipeTotals values exactly", () => {
    const totals = totalsFromMix();
    const macros = recipeMacros(
      [
        { ingredientId: CHICKEN_BREAST, grams: 500 },
        { ingredientId: RICE_WHITE, grams: 200 },
      ],
      totals,
    );
    const rows = nutrientProfile(totals, macros);
    const protein = rows.find((r) => r.key === "protein_g")!;
    expect(protein.total).toBeCloseTo(totals.protein_g, 5);
    const calcium = rows.find((r) => r.key === "calcium_mg")!;
    expect(calcium.total).toBeCloseTo(totals.calcium_mg, 5);
  });

  it("perKgDM scales total by 1000 / dryMatter_g", () => {
    const totals = totalsFromMix();
    const items: RecipeItem[] = [
      { ingredientId: CHICKEN_BREAST, grams: 500 },
      { ingredientId: RICE_WHITE, grams: 200 },
    ];
    const macros = recipeMacros(items, totals);
    const rows = nutrientProfile(totals, macros);
    const protein = rows.find((r) => r.key === "protein_g")!;
    const expected = (totals.protein_g / macros.totalDryMatter_g) * 1000;
    expect(protein.perKgDM).toBeCloseTo(expected, 5);
  });

  it("per1000kcal scales total by 1000 / energy_kcal", () => {
    const totals = totalsFromMix();
    const items: RecipeItem[] = [
      { ingredientId: CHICKEN_BREAST, grams: 500 },
      { ingredientId: RICE_WHITE, grams: 200 },
    ];
    const macros = recipeMacros(items, totals);
    const rows = nutrientProfile(totals, macros);
    const protein = rows.find((r) => r.key === "protein_g")!;
    const expected = (totals.protein_g / totals.energy_kcal) * 1000;
    expect(protein.per1000kcal).toBeCloseTo(expected, 5);
  });

  it("returns zeros for an empty recipe", () => {
    const totals = recipeTotals([]);
    const macros = recipeMacros([], totals);
    const rows = nutrientProfile(totals, macros);
    rows.forEach((r) => {
      expect(r.total).toBe(0);
      expect(r.perKgDM).toBe(0);
      expect(r.per1000kcal).toBe(0);
    });
  });
});
