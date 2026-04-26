import { describe, expect, it } from "vitest";
import {
  aafcoComparison,
  recipeMacros,
  recipeTotals,
  type RecipeItem,
} from "@shared/calc";
import { INGREDIENT_BY_ID } from "@shared/ingredients";

/**
 * Regression tests for the live-recalculation contract.
 *
 * The Wizard and Simple Composer rely on `useMemo` chains
 *   items -> totals -> macros -> aafco
 * so the underlying pure functions MUST be:
 *   1. Linear in `grams` (replacing 100g with 200g must double every nutrient).
 *   2. Additive across items (sum of two ingredients = sum of their separate totals).
 *   3. Reactive on remove (removing an item must subtract its contribution).
 *
 * If any of these regress, the SummaryCard / AafcoPanel will silently show
 * stale or wrong numbers as the user adds/removes ingredients.
 */

const CHICKEN_BREAST = 65; // INGREDIENT_BY_ID id from seed; verified below
const RICE_WHITE = 1;

describe("recipe reactivity (totals/macros/aafco respond to item mutations)", () => {
  it("totals scale linearly when grams of a single ingredient change", () => {
    const at100: RecipeItem[] = [{ ingredientId: CHICKEN_BREAST, grams: 100 }];
    const at200: RecipeItem[] = [{ ingredientId: CHICKEN_BREAST, grams: 200 }];

    const t100 = recipeTotals(at100);
    const t200 = recipeTotals(at200);

    expect(t200.protein_g).toBeCloseTo(t100.protein_g * 2, 5);
    expect(t200.energy_kcal).toBeCloseTo(t100.energy_kcal * 2, 5);
    expect(t200.calcium_mg).toBeCloseTo(t100.calcium_mg * 2, 5);
  });

  it("totals are additive when adding a second ingredient", () => {
    const onlyChicken: RecipeItem[] = [{ ingredientId: CHICKEN_BREAST, grams: 300 }];
    const onlyRice: RecipeItem[] = [{ ingredientId: RICE_WHITE, grams: 150 }];
    const both: RecipeItem[] = [...onlyChicken, ...onlyRice];

    const tA = recipeTotals(onlyChicken);
    const tB = recipeTotals(onlyRice);
    const tBoth = recipeTotals(both);

    expect(tBoth.protein_g).toBeCloseTo(tA.protein_g + tB.protein_g, 5);
    expect(tBoth.carb_g).toBeCloseTo(tA.carb_g + tB.carb_g, 5);
    expect(tBoth.energy_kcal).toBeCloseTo(tA.energy_kcal + tB.energy_kcal, 5);
  });

  it("removing an item drops totals by exactly that ingredient's contribution", () => {
    const before: RecipeItem[] = [
      { ingredientId: CHICKEN_BREAST, grams: 300 },
      { ingredientId: RICE_WHITE, grams: 150 },
    ];
    const after: RecipeItem[] = [{ ingredientId: CHICKEN_BREAST, grams: 300 }];
    const removed: RecipeItem[] = [{ ingredientId: RICE_WHITE, grams: 150 }];

    const tBefore = recipeTotals(before);
    const tAfter = recipeTotals(after);
    const tRemoved = recipeTotals(removed);

    expect(tBefore.energy_kcal - tAfter.energy_kcal).toBeCloseTo(
      tRemoved.energy_kcal,
      5,
    );
    expect(tBefore.calcium_mg - tAfter.calcium_mg).toBeCloseTo(
      tRemoved.calcium_mg,
      5,
    );
  });

  it("AAFCO comparison reflects updated totals after a mutation (no stale rows)", () => {
    const empty: RecipeItem[] = [];
    const filled: RecipeItem[] = [
      { ingredientId: CHICKEN_BREAST, grams: 500 },
      { ingredientId: RICE_WHITE, grams: 200 },
    ];

    const tEmpty = recipeTotals(empty);
    const mEmpty = recipeMacros(empty, tEmpty);
    const aEmpty = aafcoComparison(tEmpty, mEmpty, "dog", false);

    const tFilled = recipeTotals(filled);
    const mFilled = recipeMacros(filled, tFilled);
    const aFilled = aafcoComparison(tFilled, mFilled, "dog", false);

    // Empty recipe: every nutrient must be below-min
    for (const row of aEmpty) {
      expect(row.status).toBe("below");
    }

    // Filled recipe: at least the protein row must change away from "below"
    // (chicken breast is highly protein-dense, so 500g + 200g rice clears the
    // dog adult minimum 18% DM with room to spare).
    const protein = aFilled.find((r) => r.nutrient.key === "protein_g");
    expect(protein).toBeDefined();
    expect(protein!.status).not.toBe("below");
  });

  it("reference ingredient IDs (CHICKEN_BREAST, RICE_WHITE) exist in the seed DB", () => {
    expect(INGREDIENT_BY_ID[CHICKEN_BREAST]).toBeDefined();
    expect(INGREDIENT_BY_ID[RICE_WHITE]).toBeDefined();
  });
});
