import { describe, it, expect } from "vitest";
import { generateRecipePdf } from "./pdfExport";

const sample = {
  recipe: {
    name: "Test recipe",
    petName: "Rex",
    species: "dog" as const,
    lifeStageKey: "adult_neutered",
    bodyWeightKg: 10,
    lifeStageFactor: 1.6,
    items: [
      { ingredientId: 1, grams: 500 }, // chicken breast (assumed valid id range)
      { ingredientId: 2, grams: 300 },
      { ingredientId: 3, grams: 200 },
    ],
    notes: null,
    status: "draft" as const,
    updatedAt: new Date("2026-05-01T00:00:00Z"),
  },
};

describe("generateRecipePdf", () => {
  it("produces a non-empty PDF buffer for English", async () => {
    const buf = await generateRecipePdf({ lang: "en", ...sample });
    expect(buf.length).toBeGreaterThan(2000);
    // PDF magic header
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("produces a PDF for Thai (Noto Thai font path)", async () => {
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
      recipe: { ...sample.recipe, items: [] },
    });
    expect(buf.length).toBeGreaterThan(1500);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
