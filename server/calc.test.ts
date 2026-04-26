import { describe, expect, it } from "vitest";
import {
  recipeTotals,
  recipeMacros,
  aafcoComparison,
  dailyFeed,
  type RecipeItem,
} from "../shared/calc";
import { INGREDIENT_BY_ID } from "../shared/ingredients";
import { der, ATWATER } from "../shared/aafco";

// ---------------------------------------------------------------------------
// recipeTotals — basic math
// ---------------------------------------------------------------------------

describe("recipeTotals", () => {
  it("returns zeros for an empty recipe", () => {
    const t = recipeTotals([]);
    expect(t.energy_kcal).toBe(0);
    expect(t.protein_g).toBe(0);
    expect(t.water_g).toBe(0);
    expect(t.calcium_mg).toBe(0);
  });

  it("scales nutrients linearly with grams", () => {
    // Pick any well-known ingredient by ID. Find one with non-zero protein.
    const yogurt = Object.values(INGREDIENT_BY_ID).find((i) => i.name_en === "Yogurt");
    expect(yogurt).toBeDefined();
    if (!yogurt) return;
    const items: RecipeItem[] = [{ ingredientId: yogurt.id, grams: 100 }];
    const t100 = recipeTotals(items);
    expect(t100.energy_kcal).toBeCloseTo(yogurt.energy_kcal, 5);
    expect(t100.protein_g).toBeCloseTo(yogurt.protein_g, 5);

    const items50: RecipeItem[] = [{ ingredientId: yogurt.id, grams: 50 }];
    const t50 = recipeTotals(items50);
    expect(t50.energy_kcal).toBeCloseTo(yogurt.energy_kcal / 2, 5);
    expect(t50.protein_g).toBeCloseTo(yogurt.protein_g / 2, 5);
  });

  it("sums totals across multiple ingredients", () => {
    const ids = Object.values(INGREDIENT_BY_ID).slice(0, 3);
    const items: RecipeItem[] = ids.map((i) => ({ ingredientId: i.id, grams: 100 }));
    const t = recipeTotals(items);
    const expectedKcal = ids.reduce((s, i) => s + i.energy_kcal, 0);
    expect(t.energy_kcal).toBeCloseTo(expectedKcal, 5);
  });

  it("ignores unknown ingredient IDs", () => {
    const t = recipeTotals([{ ingredientId: 999_999, grams: 100 }]);
    expect(t.energy_kcal).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// recipeMacros — moisture %, energy density, P/F/C on DM and ME
// ---------------------------------------------------------------------------

describe("recipeMacros", () => {
  it("computes moisture and DM percentages correctly", () => {
    // Construct a synthetic recipe: 100 g of an item with 75 g water, 25 g DM
    // Use chicken breast or any meat
    const meat = Object.values(INGREDIENT_BY_ID).find(
      (i) => i.water_g > 70 && i.protein_g > 15 && i.energy_kcal > 80,
    );
    expect(meat).toBeDefined();
    if (!meat) return;
    const items: RecipeItem[] = [{ ingredientId: meat.id, grams: 100 }];
    const totals = recipeTotals(items);
    const macros = recipeMacros(items, totals);
    expect(macros.totalGrams).toBe(100);
    expect(macros.totalWater_g).toBeCloseTo(meat.water_g, 5);
    expect(macros.totalDryMatter_g).toBeCloseTo(100 - meat.water_g, 5);
    expect(macros.moisturePct).toBeCloseTo(meat.water_g, 3);
    expect(macros.energyDensity_kcal_per_g).toBeCloseTo(meat.energy_kcal / 100, 5);
  });

  it("ME% uses Atwater (P=3.5, F=8.5, C=3.5) and sums to ~100", () => {
    // Synthetic: pick a recipe with all three macros present
    const ing = Object.values(INGREDIENT_BY_ID).find(
      (i) => i.protein_g > 5 && i.fat_g > 2 && i.carb_g > 5,
    );
    expect(ing).toBeDefined();
    if (!ing) return;
    const items: RecipeItem[] = [{ ingredientId: ing.id, grams: 100 }];
    const totals = recipeTotals(items);
    const macros = recipeMacros(items, totals);

    const meKcal =
      ing.protein_g * ATWATER.protein +
      ing.fat_g * ATWATER.fat +
      ing.carb_g * ATWATER.carb;
    const expectedP_ME = (ing.protein_g * ATWATER.protein) / meKcal * 100;
    expect(macros.proteinPct_ME).toBeCloseTo(expectedP_ME, 3);
    expect(macros.proteinPct_ME + macros.fatPct_ME + macros.carbPct_ME).toBeCloseTo(100, 3);
  });

  it("returns zeros for empty recipe", () => {
    const m = recipeMacros([], recipeTotals([]));
    expect(m.totalGrams).toBe(0);
    expect(m.energyDensity_kcal_per_g).toBe(0);
    expect(m.moisturePct).toBe(0);
    expect(m.proteinPct_DM).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// aafcoComparison — status and unit conversions
// ---------------------------------------------------------------------------

describe("aafcoComparison", () => {
  it("flags below-min when recipe is empty (all targets unmet)", () => {
    const totals = recipeTotals([]);
    const macros = recipeMacros([], totals);
    const rows = aafcoComparison(totals, macros, "dog", false);
    // Dog AAFCO has min for crude protein (180 g/kg DM adult)
    const protein = rows.find((r) => r.nutrient.key === "protein_g");
    expect(protein).toBeDefined();
    if (!protein) return;
    expect(protein.min).toBe(180);
    // Empty recipe → DM = 0 → perKgDM should be 0 → below min
    expect(protein.perKgDM).toBe(0);
    expect(protein.status).toBe("below");
  });

  it("converts mg minerals to g/kg DM (e.g., calcium)", () => {
    // 100 g of any ingredient with calcium ~120 mg, water ~80 g → DM = 20 g
    // Calcium per kg DM = 120 / (20/1000) = 6000 mg/kg DM = 6.0 g/kg DM
    const ing = Object.values(INGREDIENT_BY_ID).find(
      (i) => i.calcium_mg > 100 && i.water_g > 70,
    );
    if (!ing) return;
    const items: RecipeItem[] = [{ ingredientId: ing.id, grams: 100 }];
    const totals = recipeTotals(items);
    const macros = recipeMacros(items, totals);
    const rows = aafcoComparison(totals, macros, "dog", false);
    const ca = rows.find((r) => r.nutrient.key === "calcium_mg");
    expect(ca).toBeDefined();
    if (!ca) return;
    // Hand calc:
    //   total Ca = ing.calcium_mg, total DM = 100 - ing.water_g grams
    //   mg_per_kgDM = total_mg / (DM_g/1000) = total_mg * 1000 / DM_g
    //   g_per_kgDM = mg_per_kgDM / 1000 = total_mg / DM_g
    const expectedG_per_kg = ing.calcium_mg / (100 - ing.water_g);
    expect(ca.perKgDM).toBeCloseTo(expectedG_per_kg, 2);
  });

  it("species selection picks the correct profile (cat protein min = 26 = 260 g/kg DM)", () => {
    const totals = recipeTotals([]);
    const macros = recipeMacros([], totals);
    const catRows = aafcoComparison(totals, macros, "cat", false);
    const dogRows = aafcoComparison(totals, macros, "dog", false);
    const catProt = catRows.find((r) => r.nutrient.key === "protein_g");
    const dogProt = dogRows.find((r) => r.nutrient.key === "protein_g");
    expect(catProt?.min).toBe(260);
    expect(dogProt?.min).toBe(180);
  });

  it("uses growth profile when isGrowth=true", () => {
    const totals = recipeTotals([]);
    const macros = recipeMacros([], totals);
    const adult = aafcoComparison(totals, macros, "dog", false);
    const growth = aafcoComparison(totals, macros, "dog", true);
    const adultProt = adult.find((r) => r.nutrient.key === "protein_g");
    const growthProt = growth.find((r) => r.nutrient.key === "protein_g");
    expect(adultProt?.min).toBe(180);
    expect(growthProt?.min).toBe(225);
  });
});

// ---------------------------------------------------------------------------
// dailyFeed — DER, feeding grams, water
// ---------------------------------------------------------------------------

describe("dailyFeed", () => {
  it("computes DER as RER × factor (NRC: RER = 70 × BW^0.75)", () => {
    // 10 kg dog, neutered adult factor 1.6 → DER = 70 × 10^0.75 × 1.6 ≈ 630 kcal
    const expected = 70 * Math.pow(10, 0.75) * 1.6;
    expect(der(10, 1.6)).toBeCloseTo(expected, 3);
  });

  it("computes feeding grams from energy density", () => {
    // Synthetic: macros where energy density = 1.5 kcal/g, DER = 600 → 400 g/day
    const macros = {
      totalGrams: 1000,
      totalKcal: 1500,
      totalDryMatter_g: 300,
      totalWater_g: 700,
      energyDensity_kcal_per_g: 1.5,
      moisturePct: 70,
      proteinPct_DM: 50,
      fatPct_DM: 20,
      carbPct_DM: 30,
      proteinPct_ME: 0,
      fatPct_ME: 0,
      carbPct_ME: 0,
    };
    // 10 kg dog × 1.6 → DER = 70 × 10^0.75 × 1.6 ≈ 630
    const f = dailyFeed(10, 1.6, macros);
    const expectedDER = 70 * Math.pow(10, 0.75) * 1.6;
    expect(f.derKcal).toBeCloseTo(expectedDER, 3);
    expect(f.feedingGrams).toBeCloseTo(expectedDER / 1.5, 3);
  });

  it("water-from-food = moisture % × feeding grams", () => {
    const macros = {
      totalGrams: 1000,
      totalKcal: 1500,
      totalDryMatter_g: 300,
      totalWater_g: 700,
      energyDensity_kcal_per_g: 1.5,
      moisturePct: 70,
      proteinPct_DM: 0,
      fatPct_DM: 0,
      carbPct_DM: 0,
      proteinPct_ME: 0,
      fatPct_ME: 0,
      carbPct_ME: 0,
    };
    const f = dailyFeed(10, 1.6, macros);
    expect(f.waterFromFood_mL).toBeCloseTo(0.7 * f.feedingGrams, 3);
    // Water-still-needed should equal max(0, energy-water - food-water)
    expect(f.waterStillNeeded_mL).toBeCloseTo(
      Math.max(f.waterFromEnergy_mL - f.waterFromFood_mL, 0),
      3,
    );
  });

  it("returns 0 feeding grams if energy density is 0", () => {
    const macros = {
      totalGrams: 0,
      totalKcal: 0,
      totalDryMatter_g: 0,
      totalWater_g: 0,
      energyDensity_kcal_per_g: 0,
      moisturePct: 0,
      proteinPct_DM: 0,
      fatPct_DM: 0,
      carbPct_DM: 0,
      proteinPct_ME: 0,
      fatPct_ME: 0,
      carbPct_ME: 0,
    };
    const f = dailyFeed(10, 1.6, macros);
    expect(f.feedingGrams).toBe(0);
    expect(f.waterFromFood_mL).toBe(0);
  });
});
