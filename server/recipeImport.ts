/**
 * Parse a Guga recipe file from either:
 *   - a raw `.guga.json` buffer
 *   - an exported PDF that has the `%%GUGA_RECIPE_v1:<base64>` marker appended
 *     after the trailing %%EOF (see server/pdfExport.ts::generateRecipePdf).
 *
 * Returns the validated portable recipe, the source kind, and a list of
 * ingredient ids that were dropped because they aren't in the current
 * ingredient catalog.
 */

import { INGREDIENT_BY_ID } from "@shared/ingredients";
import {
  PDF_EMBED_MARKER_PREFIX,
  recipeFileSchema,
  type PortableRecipe,
} from "@shared/recipeFile";

export type ImportSource = "pdf" | "file";

export interface ParsedImport {
  source: ImportSource;
  recipe: PortableRecipe;
  /** Ingredient ids in the file that aren't in the local catalog. */
  unknownIngredientIds: number[];
}

function extractEmbeddedJson(buf: Buffer): string | null {
  // Search the trailing 64 KiB for the marker — the marker is appended after
  // %%EOF and PDFs we generate are well under 1 MiB, so a tail-scan is cheap
  // and avoids decoding the (binary) PDF body.
  const tail = buf.subarray(Math.max(0, buf.length - 65536)).toString("utf8");
  const idx = tail.lastIndexOf(PDF_EMBED_MARKER_PREFIX);
  if (idx < 0) return null;
  const after = tail.slice(idx + PDF_EMBED_MARKER_PREFIX.length);
  // Marker line ends at the next newline (or EOF).
  const nl = after.search(/[\r\n]/);
  const b64 = (nl >= 0 ? after.slice(0, nl) : after).trim();
  if (!b64) return null;
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

export function parseRecipeImport(file: Buffer, contentType?: string | null): ParsedImport {
  const isPdf =
    (contentType ?? "").toLowerCase().includes("pdf") ||
    (file.length >= 4 && file.subarray(0, 4).toString("ascii") === "%PDF");

  let source: ImportSource;
  let jsonText: string | null = null;

  if (isPdf) {
    source = "pdf";
    jsonText = extractEmbeddedJson(file);
    if (!jsonText) {
      throw new ImportError(
        "This PDF doesn't look like a Guga recipe export — no embedded recipe data found.",
      );
    }
  } else {
    source = "file";
    jsonText = file.toString("utf8").trim();
    if (!jsonText) throw new ImportError("Empty file.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new ImportError(
      source === "pdf"
        ? "The embedded recipe data in this PDF is corrupted."
        : "This doesn't look like a Guga recipe file (invalid JSON).",
    );
  }

  const parsed = recipeFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ImportError("This doesn't look like a Guga recipe file.");
  }

  const recipe = parsed.data.recipe;
  const knownItems = recipe.items.filter((i) => INGREDIENT_BY_ID[i.ingredientId]);
  const unknownIngredientIds = recipe.items
    .filter((i) => !INGREDIENT_BY_ID[i.ingredientId])
    .map((i) => i.ingredientId);

  return {
    source,
    recipe: { ...recipe, items: knownItems },
    unknownIngredientIds,
  };
}
