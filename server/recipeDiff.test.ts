import { describe, expect, it } from "vitest";
import { diffRecipes, isEmptyDiff } from "./recipeDiff";
import type { Recipe } from "../drizzle/schema";

function baseRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 1,
    userId: 10,
    updatedByUserId: 10,
    name: "R1",
    petName: null,
    petId: null,
    species: "dog",
    lifeStage: "adult",
    bodyWeightKg: "10",
    lifeStageFactor: "1.6",
    feedingMode: "normal",
    workflow: "simple",
    startingVolumeG: 1000,
    targetProteinPct: null,
    targetCarbPct: null,
    items: [
      { ingredientId: 1, grams: 100 },
      { ingredientId: 2, grams: 50 },
    ],
    notes: null,
    status: "draft",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  } as Recipe;
}

describe("diffRecipes", () => {
  it("returns empty diff when nothing changed", () => {
    const r = baseRecipe();
    const diff = diffRecipes(r, r);
    expect(isEmptyDiff(diff)).toBe(true);
  });

  it("detects added/removed/changed ingredients", () => {
    const before = baseRecipe();
    const after = baseRecipe({
      items: [
        { ingredientId: 1, grams: 120 }, // changed
        { ingredientId: 3, grams: 80 }, // added; ingredient 2 removed
      ],
    });
    const diff = diffRecipes(before, after);
    expect(diff.ingredientsAdded).toEqual([{ ingredientId: 3, afterGrams: 80 }]);
    expect(diff.ingredientsRemoved).toEqual([{ ingredientId: 2, beforeGrams: 50 }]);
    expect(diff.ingredientsChanged).toEqual([
      { ingredientId: 1, beforeGrams: 100, afterGrams: 120 },
    ]);
    expect(isEmptyDiff(diff)).toBe(false);
  });

  it("detects scalar field changes (name, status, weight)", () => {
    const before = baseRecipe();
    const after = baseRecipe({ name: "R1 v2", status: "approved", bodyWeightKg: "12" });
    const diff = diffRecipes(before, after);
    const fieldNames = diff.fields.map((f) => f.field).sort();
    expect(fieldNames).toEqual(["bodyWeightKg", "name", "status"]);
  });
});
