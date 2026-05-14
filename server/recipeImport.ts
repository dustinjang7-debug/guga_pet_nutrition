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

function decodeMarkerB64(b64: string): string | null {
  if (!b64) return null;
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/** Read the marker from the trailing %%GUGA_RECIPE_v1: line (preferred). */
function extractFromTail(buf: Buffer): string | null {
  // Search the trailing 64 KiB only — appended marker is just past %%EOF
  // and our PDFs are well under 1 MiB, so a tail-scan is cheap and
  // avoids decoding the (binary) PDF body.
  const tail = buf.subarray(Math.max(0, buf.length - 65536)).toString("utf8");
  const idx = tail.lastIndexOf(PDF_EMBED_MARKER_PREFIX);
  if (idx < 0) return null;
  const after = tail.slice(idx + PDF_EMBED_MARKER_PREFIX.length);
  const nl = after.search(/[\r\n]/);
  return decodeMarkerB64((nl >= 0 ? after.slice(0, nl) : after).trim());
}

/**
 * Fallback: read the marker from the PDF info dictionary `/Keywords` entry.
 * Survives tools that strip trailing bytes after %%EOF. We deliberately keep
 * this lightweight (no full PDF parse) — we just look for the literal
 * `/Keywords (...)` sequence inside the PDF body.
 */
function extractFromInfoDict(buf: Buffer): string | null {
  // PDF Info entries typically appear in plain ASCII inside the file body.
  const text = buf.toString("latin1");
  // Match (...) literal strings; PDF escapes parens with backslash, but we
  // emit our marker via PDFKit's own escaping so a non-greedy match suffices.
  const re = new RegExp(`/Keywords\\s*\\((${PDF_EMBED_MARKER_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[A-Za-z0-9+/=]+)\\)`);
  const m = text.match(re);
  if (!m) return null;
  const value = m[1];
  return decodeMarkerB64(value.slice(PDF_EMBED_MARKER_PREFIX.length));
}

function extractEmbeddedJson(buf: Buffer): string | null {
  return extractFromTail(buf) ?? extractFromInfoDict(buf);
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
