import { describe, expect, it } from "vitest";
import { generateRecipePdf } from "./pdfExport";
import { parseRecipeImport, ImportError } from "./recipeImport";
import { portableRecipeSchema, RECIPE_FILE_VERSION } from "../shared/recipeFile";

function samplePortable() {
  return portableRecipeSchema.parse({
    name: "Test recipe",
    petName: "Bella",
    species: "dog" as const,
    lifeStage: "adult",
    bodyWeightKg: 10,
    lifeStageFactor: 1.6,
    feedingMode: "normal" as const,
    workflow: "simple" as const,
    startingVolumeG: 1000,
    items: [
      { ingredientId: 1, grams: 100 },
      { ingredientId: 2, grams: 50 },
    ],
  });
}

describe("parseRecipeImport — JSON", () => {
  it("parses a valid .guga.json buffer", () => {
    const file = {
      guga: RECIPE_FILE_VERSION,
      exportedAt: new Date().toISOString(),
      recipe: samplePortable(),
    };
    const buf = Buffer.from(JSON.stringify(file), "utf8");
    const parsed = parseRecipeImport(buf, "application/json");
    expect(parsed.source).toBe("file");
    expect(parsed.recipe.name).toBe("Test recipe");
    expect(parsed.recipe.items).toHaveLength(2);
  });

  it("rejects unknown JSON shape", () => {
    const buf = Buffer.from(JSON.stringify({ hello: "world" }), "utf8");
    expect(() => parseRecipeImport(buf, "application/json")).toThrow(ImportError);
  });
});

describe("parseRecipeImport — PDF round-trip", () => {
  it("recovers the recipe from an exported PDF tail marker", async () => {
    const pdf = await generateRecipePdf({
      lang: "en",
      recipe: {
        name: "PDF round-trip",
        petName: null,
        petId: null,
        species: "dog",
        lifeStageKey: "adult",
        bodyWeightKg: 10,
        lifeStageFactor: 1.6,
        items: [{ ingredientId: 1, grams: 100 }],
        notes: null,
        status: "draft",
        updatedAt: new Date(),
        ownerName: null,
        ownerEmail: null,
      },
    });
    const parsed = parseRecipeImport(pdf, "application/pdf");
    expect(parsed.source).toBe("pdf");
    expect(parsed.recipe.name).toBe("PDF round-trip");
    expect(parsed.recipe.items[0]?.ingredientId).toBe(1);
  });

  it("throws ImportError when PDF has no marker", () => {
    const fakePdf = Buffer.from("%PDF-1.4\n...random bytes...\n%%EOF\n", "utf8");
    expect(() => parseRecipeImport(fakePdf, "application/pdf")).toThrow(ImportError);
  });
});
