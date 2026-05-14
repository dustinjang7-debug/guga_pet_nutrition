/**
 * Portable recipe file format. Embedded inside exported PDFs (after the
 * %%EOF marker, see server/pdfExport.ts) and also offered as a standalone
 * `.guga.json` download.
 *
 * Schema is versioned via the top-level `guga` integer. Bump it when the
 * shape changes in a non-additive way; keep the importer compatible with
 * older versions.
 */

import { z } from "zod";

export const RECIPE_FILE_VERSION = 1;
export const RECIPE_FILE_MIME = "application/vnd.guga.recipe+json";
export const RECIPE_FILE_EXT = ".guga.json";

/** Marker appended after PDF %%EOF: `\n%%GUGA_RECIPE_v1:<base64>\n`. */
export const PDF_EMBED_MARKER_PREFIX = "%%GUGA_RECIPE_v1:";

export const portableRecipeItemSchema = z.object({
  ingredientId: z.number().int().positive(),
  grams: z.number().nonnegative(),
});

export const portableRecipeSchema = z.object({
  name: z.string().min(1).max(200),
  petName: z.string().max(100).nullish(),
  petId: z.string().max(64).nullish(),
  species: z.enum(["dog", "cat"]),
  lifeStage: z.string().max(64),
  bodyWeightKg: z.number().positive().max(200),
  lifeStageFactor: z.number().positive().max(10),
  feedingMode: z.enum(["normal", "weight_loss"]).default("normal"),
  workflow: z.enum(["wizard", "simple", "premix"]).default("simple"),
  startingVolumeG: z.number().int().positive().max(100000).default(1000),
  targetProteinPct: z.number().min(0).max(100).nullish(),
  targetCarbPct: z.number().min(0).max(100).nullish(),
  items: z.array(portableRecipeItemSchema),
  notes: z.string().nullish(),
});

export type PortableRecipe = z.infer<typeof portableRecipeSchema>;

/**
 * The top-level wrapper is intentionally version-tolerant: we accept any
 * positive integer for `guga` so an importer running an older build can
 * still read files exported by a newer build, as long as the inner
 * `recipe` shape parses. Breaking shape changes should add fields with
 * `.nullish()` defaults rather than bumping into a strict literal.
 */
export const recipeFileSchema = z.object({
  guga: z.number().int().positive(),
  exportedAt: z.string().optional(),
  recipe: portableRecipeSchema,
});

export type RecipeFile = z.infer<typeof recipeFileSchema>;

export function makeRecipeFile(recipe: PortableRecipe): RecipeFile {
  return {
    guga: RECIPE_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    recipe,
  };
}
