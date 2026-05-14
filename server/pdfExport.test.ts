import { describe, it, expect } from "vitest";
import { generateRecipePdf } from "./pdfExport";
import { recipeTotals, recipeMacros } from "@shared/calc";
import { INGREDIENT_BY_ID } from "@shared/ingredients";
import { pt } from "@shared/pdfI18n";

const baseRecipe = {
  name: "Test recipe",
  petName: "Rex",
  petId: "PET-001",
  species: "dog" as const,
  lifeStageKey: "adult_neutered",
  bodyWeightKg: 10,
  lifeStageFactor: 1.6,
  items: [
    { ingredientId: 1, grams: 500 },
    { ingredientId: 2, grams: 300 },
    { ingredientId: 3, grams: 200 },
  ],
  notes: null as string | null,
  status: "draft" as "draft" | "approved",
  updatedAt: new Date("2026-05-01T00:00:00Z"),
  ownerName: "Alice Owner",
  ownerEmail: "alice@example.com",
};

const sample = { recipe: baseRecipe };

/**
 * PDF text streams are compressed/encoded so we can't easily grep glyphs.
 * We verify structural growth instead: adding new sections must enlarge the
 * PDF compared with a stripped-down baseline, and the totals helper must
 * agree with what the per-ingredient table would print.
 */
describe("generateRecipePdf", () => {
  it("produces a non-empty PDF buffer for English", async () => {
    const buf = await generateRecipePdf({ lang: "en", ...sample });
    expect(buf.length).toBeGreaterThan(2000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("produces a PDF for Thai (Sarabun font path)", async () => {
    const buf = await generateRecipePdf({ lang: "th", ...sample });
    expect(buf.length).toBeGreaterThan(2000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("produces a PDF for Chinese (Noto SC font path)", async () => {
    const buf = await generateRecipePdf({ lang: "zh", ...sample });
    expect(buf.length).toBeGreaterThan(2000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("handles a recipe with zero ingredients gracefully", async () => {
    const buf = await generateRecipePdf({
      lang: "en",
      recipe: { ...baseRecipe, items: [] },
    });
    expect(buf.length).toBeGreaterThan(1500);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("renders both draft and approved status pills", async () => {
    const draft = await generateRecipePdf({
      lang: "en", recipe: { ...baseRecipe, status: "draft" },
    });
    const approved = await generateRecipePdf({
      lang: "en", recipe: { ...baseRecipe, status: "approved" },
    });
    // Different status labels produce different byte streams.
    expect(draft.length).toBeGreaterThan(2000);
    expect(approved.length).toBeGreaterThan(2000);
    expect(draft.equals(approved)).toBe(false);
  });

  it("includes a notes section only when notes are non-empty", async () => {
    const empty = await generateRecipePdf({
      lang: "en", recipe: { ...baseRecipe, notes: null },
    });
    const withNotes = await generateRecipePdf({
      lang: "en",
      recipe: {
        ...baseRecipe,
        notes: "Feed twice daily. Watch weight; reduce portion if needed.",
      },
    });
    // Adding notes section + heading must enlarge the PDF.
    expect(withNotes.length).toBeGreaterThan(empty.length);
  });

  it("per-ingredient nutrient totals match recipeTotals", () => {
    const items = baseRecipe.items.filter(it => INGREDIENT_BY_ID[it.ingredientId]);
    const totals = recipeTotals(items);
    const macros = recipeMacros(items, totals);

    // Per-row scaling must sum back to the totals the table footer prints.
    let p = 0, f = 0, c = 0, fb = 0, w = 0, kcal = 0, g = 0;
    for (const it of items) {
      const ing = INGREDIENT_BY_ID[it.ingredientId];
      const factor = it.grams / 100;
      p += ing.protein_g * factor;
      f += ing.fat_g * factor;
      c += ing.carb_g * factor;
      fb += ing.fiber_g * factor;
      w += ing.water_g * factor;
      kcal += ing.energy_kcal * factor;
      g += it.grams;
    }
    expect(p).toBeCloseTo(totals.protein_g, 6);
    expect(f).toBeCloseTo(totals.fat_g, 6);
    expect(c).toBeCloseTo(totals.carb_g, 6);
    expect(fb).toBeCloseTo(totals.fiber_g, 6);
    expect(w).toBeCloseTo(totals.water_g, 6);
    expect(kcal).toBeCloseTo(macros.totalKcal, 6);
    expect(g).toBeCloseTo(macros.totalGrams, 6);
  });

  it("i18n keys exist for the new sections in all three languages", () => {
    for (const lang of ["en", "zh", "th"] as const) {
      for (const key of [
        "status_draft", "status_approved", "owner", "pet_id",
        "macros_title", "macro_protein", "macro_fat", "macro_carb",
        "macro_fiber", "macro_ash", "macro_moisture",
        "col_pct_dm", "col_pct_me", "col_grams",
        "nutrient_contrib_title", "col_protein_g", "col_fat_g",
        "col_carb_g", "col_fiber_g", "col_water_g", "total_row",
        "notes_title", "notes_empty",
      ] as const) {
        expect(pt(lang, key)).toBeTruthy();
      }
    }
  });
});
