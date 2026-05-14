/**
 * Recipe diff: structured comparison of two recipe snapshots.
 *
 * Used when writing `edited` activity log entries so the History panel
 * can render a human-readable summary of what changed.
 *
 * The diff is intentionally simple JSON (no class instances) so it can
 * round-trip through `jsonb` without surprises.
 */

import type { Recipe } from "../drizzle/schema";

export interface IngredientChange {
  ingredientId: number;
  beforeGrams?: number;
  afterGrams?: number;
}

export interface FieldChange<T = unknown> {
  field: string;
  before: T | null;
  after: T | null;
}

export interface RecipeDiff {
  ingredientsAdded: IngredientChange[];
  ingredientsRemoved: IngredientChange[];
  ingredientsChanged: IngredientChange[];
  fields: FieldChange[];
}

const TRACKED_FIELDS = [
  "name",
  "petName",
  "petId",
  "species",
  "lifeStage",
  "bodyWeightKg",
  "lifeStageFactor",
  "feedingMode",
  "workflow",
  "startingVolumeG",
  "targetProteinPct",
  "targetCarbPct",
  "notes",
  "status",
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

interface RecipeItem {
  ingredientId: number;
  grams: number;
}

function readItems(items: unknown): RecipeItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const obj = it as Record<string, unknown>;
      const id = Number(obj.ingredientId);
      const grams = typeof obj.grams === "string" ? parseFloat(obj.grams) : Number(obj.grams);
      if (!Number.isFinite(id) || !Number.isFinite(grams)) return null;
      return { ingredientId: id, grams };
    })
    .filter((x): x is RecipeItem => x !== null);
}

function normalizeFieldValue(field: TrackedField, value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  // Numeric fields come back from Postgres as strings via drizzle.
  if (
    field === "bodyWeightKg" ||
    field === "lifeStageFactor" ||
    field === "targetProteinPct" ||
    field === "targetCarbPct"
  ) {
    const n = typeof value === "string" ? parseFloat(value) : Number(value);
    return Number.isFinite(n) ? Number(n.toFixed(4)) : null;
  }
  if (field === "startingVolumeG") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return String(value);
}

export function diffRecipes(prev: Recipe, next: Recipe): RecipeDiff {
  const prevItems = new Map(readItems(prev.items).map((i) => [i.ingredientId, i.grams]));
  const nextItems = new Map(readItems(next.items).map((i) => [i.ingredientId, i.grams]));

  const ingredientsAdded: IngredientChange[] = [];
  const ingredientsRemoved: IngredientChange[] = [];
  const ingredientsChanged: IngredientChange[] = [];

  Array.from(nextItems.entries()).forEach(([id, grams]) => {
    if (!prevItems.has(id)) {
      ingredientsAdded.push({ ingredientId: id, afterGrams: grams });
    } else if (Math.abs((prevItems.get(id) ?? 0) - grams) > 0.001) {
      ingredientsChanged.push({
        ingredientId: id,
        beforeGrams: prevItems.get(id),
        afterGrams: grams,
      });
    }
  });
  Array.from(prevItems.entries()).forEach(([id, grams]) => {
    if (!nextItems.has(id)) {
      ingredientsRemoved.push({ ingredientId: id, beforeGrams: grams });
    }
  });

  const fields: FieldChange[] = [];
  for (const f of TRACKED_FIELDS) {
    const before = normalizeFieldValue(f, (prev as unknown as Record<string, unknown>)[f]);
    const after = normalizeFieldValue(f, (next as unknown as Record<string, unknown>)[f]);
    if (before !== after) fields.push({ field: f, before, after });
  }

  return {
    ingredientsAdded,
    ingredientsRemoved,
    ingredientsChanged,
    fields,
  };
}

/**
 * Plain-JSON snapshot of a recipe's content at a point in time. Stored on
 * `recipe_activity.payload.snapshot` for content-changing actions (created,
 * edited, status_changed, imported_from_*, duplicated) so owners/editors can
 * restore the recipe to any previous version from the History panel.
 *
 * Shape mirrors the tRPC `recipeInputSchema` (numbers as numbers, items as
 * array) so the restore path can feed it back through the same patch builder.
 */
export interface RecipeSnapshot {
  name: string;
  petName: string | null;
  petId: string | null;
  species: "dog" | "cat";
  lifeStage: string;
  bodyWeightKg: number;
  lifeStageFactor: number;
  feedingMode: "normal" | "weight_loss";
  workflow: "wizard" | "simple" | "premix";
  startingVolumeG: number;
  targetProteinPct: number | null;
  targetCarbPct: number | null;
  items: Array<{ ingredientId: number; grams: number }>;
  notes: string | null;
  status: "draft" | "approved";
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  return typeof v === "string" ? parseFloat(v) : Number(v);
}

function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = toNum(v);
  return Number.isFinite(n) ? n : null;
}

export function recipeToSnapshot(r: Recipe): RecipeSnapshot {
  return {
    name: r.name,
    petName: r.petName ?? null,
    petId: r.petId ?? null,
    species: r.species,
    lifeStage: r.lifeStage,
    bodyWeightKg: toNum(r.bodyWeightKg),
    lifeStageFactor: toNum(r.lifeStageFactor),
    feedingMode: r.feedingMode,
    workflow: r.workflow,
    startingVolumeG: r.startingVolumeG,
    targetProteinPct: toNumOrNull(r.targetProteinPct),
    targetCarbPct: toNumOrNull(r.targetCarbPct),
    items: readItems(r.items),
    notes: r.notes ?? null,
    status: r.status,
  };
}

export function isEmptyDiff(d: RecipeDiff): boolean {
  return (
    d.ingredientsAdded.length === 0 &&
    d.ingredientsRemoved.length === 0 &&
    d.ingredientsChanged.length === 0 &&
    d.fields.length === 0
  );
}
