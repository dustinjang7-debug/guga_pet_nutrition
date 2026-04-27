/**
 * GUGA Pet Nutrition — AAFCO Gap Remediation Suggester.
 *
 * Given the live AAFCO comparison rows for the current recipe, produce a
 * structured list of "ways to close each unmet nutrient gap":
 *   1. fresh ingredient — top 3 sources from the verified DB sorted by
 *      that nutrient density, with the grams needed to fully close the gap.
 *   2. additive — a single dedicated supplement / food additive (e.g.
 *      eggshell powder for calcium, salt for sodium, brewer's yeast for B
 *      vitamins) with the grams needed.
 *
 * Used by:
 *   - Wizard final compliance step (Step 14)
 *   - Simple Composer's AafcoPanel "auto-suggest fix" chips
 */

import { INGREDIENTS, INGREDIENT_BY_ID, type Ingredient } from "./ingredients";
import type { AafcoRow } from "./calc";

// ----------------------------------------------------------------------------
// Maps nutrient key → recommended food-additive (single, dedicated supplement)
// ----------------------------------------------------------------------------

interface AdditiveRecipe {
  /** Ingredient ID of the dedicated supplement. */
  ingredientId: number;
  /** Field key on the Ingredient interface. Used to compute grams needed. */
  nutrientField: keyof Ingredient;
  /** Optional ceiling grams to keep recommendations realistic. */
  maxGrams?: number;
}

const ADDITIVE_BY_NUTRIENT: Record<string, AdditiveRecipe | undefined> = {
  // Minerals
  calcium_mg: { ingredientId: 159, nutrientField: "calcium_mg", maxGrams: 25 }, // Eggshell powder (34,900 mg/100g)
  phosphorus_mg: { ingredientId: 7, nutrientField: "phosphorus_mg", maxGrams: 100 }, // Wheat germ (1168 mg/100g)
  sodium_mg: { ingredientId: 154, nutrientField: "sodium_mg", maxGrams: 5 }, // Salt (25,127 mg/100g)
  zinc_mg: { ingredientId: 89, nutrientField: "zinc_mg", maxGrams: 100 }, // Raw oyster (71.2 mg/100g)
  iron_mg: { ingredientId: 68, nutrientField: "iron_mg", maxGrams: 100 }, // Duck liver (23.1 mg/100g)
  copper_mg: { ingredientId: 58, nutrientField: "copper_mg", maxGrams: 100 }, // Pork liver
  manganese_mg: { ingredientId: 7, nutrientField: "manganese_mg", maxGrams: 100 }, // Wheat germ
  selenium_ug: { ingredientId: 198, nutrientField: "selenium_ug", maxGrams: 100 }, // Sardine
  potassium_mg: { ingredientId: 27, nutrientField: "potassium_mg", maxGrams: 200 }, // Sweet potato

  // Vitamins
  vit_a_re_ug: { ingredientId: 62, nutrientField: "vit_a_re_ug", maxGrams: 100 }, // Chicken liver
  vit_d_ug: { ingredientId: 133, nutrientField: "vit_d_ug", maxGrams: 100 }, // Salmon
  vit_e_mg: { ingredientId: 148, nutrientField: "vit_e_mg", maxGrams: 50 }, // Soybean oil (93 mg/100g)
  vit_b1_mg: { ingredientId: 157, nutrientField: "vit_b1_mg", maxGrams: 30 }, // Brewer's yeast
  vit_b2_mg: { ingredientId: 157, nutrientField: "vit_b2_mg", maxGrams: 30 },
  vit_b5_mg: { ingredientId: 157, nutrientField: "vit_b5_mg", maxGrams: 30 },
  vit_b6_mg: { ingredientId: 157, nutrientField: "vit_b6_mg", maxGrams: 30 },
  niacin_mg: { ingredientId: 157, nutrientField: "niacin_mg", maxGrams: 30 },
  vit_b12_ug: { ingredientId: 44, nutrientField: "vit_b12_ug", maxGrams: 100 }, // Beef liver
  folate_mg: { ingredientId: 157, nutrientField: "folate_mg", maxGrams: 30 },
  choline_mg: { ingredientId: 81, nutrientField: "choline_mg", maxGrams: 60 }, // Egg yolk
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * The ingredient nutrient values are stored per 100g raw edible.
 * AAFCO row.delta is the shortfall expressed in the AAFCO display unit per
 * kg DM (e.g. mg/kg DM, μg/kg DM, g/kg DM). We need to convert this back to
 * an absolute "milligrams (or μg) missing in the recipe right now".
 *
 * delta_perKgDM × totalDryMatter_kg = absolute amount missing (in display unit).
 *
 * Then for "g/kg DM" with mg-source nutrients we already divided by 1000 in
 * `convertToPerKgDM`, so multiply back when converting absolute amount.
 */
function gapToAbsolute(row: AafcoRow, totalDM_g: number): number {
  if (row.status !== "below" && row.status !== "borderline") return 0;
  const dmKg = totalDM_g / 1000;
  if (dmKg <= 0) return 0;
  // After the v0.2.6 unit fix, `perKgDM` (and therefore `delta`) is always
  // expressed in the SAME unit as the source ingredient field (mg for _mg keys,
  // μg for _ug keys, g for _g keys). So absolute shortfall is just delta × DM (kg).
  return row.delta * dmKg;
}

/**
 * Convert an absolute shortfall into grams of a given ingredient.
 * `nutrientField` is the matching numeric key on the Ingredient row,
 * with values per 100g.
 */
function gramsToCloseGap(absoluteShortfall: number, nutrientPer100g: number): number {
  if (nutrientPer100g <= 0) return Infinity;
  return (absoluteShortfall / nutrientPer100g) * 100;
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export interface FreshSuggestion {
  ingredient: Ingredient;
  /** Grams needed to close the gap with this ingredient alone. */
  gramsNeeded: number;
  /** Density of this nutrient per 100g of the ingredient. */
  densityPer100g: number;
}

export interface AdditiveSuggestion {
  ingredient: Ingredient;
  gramsNeeded: number;
  densityPer100g: number;
  /** Whether this recommendation hit the maxGrams ceiling. */
  cappedAtMax: boolean;
}

export interface GapSuggestion {
  /** The original AAFCO row (deficit info, labels, units). */
  row: AafcoRow;
  /** Absolute shortfall expressed in the source ingredient unit (mg / μg / g). */
  absoluteShortfall: number;
  /** Top 3 fresh-ingredient sources, ranked by gramsNeeded ascending (denser = better). */
  fresh: FreshSuggestion[];
  /** Single recommended food-additive remediation. */
  additive: AdditiveSuggestion | null;
}

/**
 * Build remediation suggestions for every nutrient currently below AAFCO.
 *
 * @param rows - the live AAFCO comparison output (one row per nutrient)
 * @param totalDM_g - the recipe's current total dry matter (grams), used to
 *                    convert per-kg-DM shortfalls into absolute shortfalls.
 * @param excludeIngredientIds - ingredients already in the recipe; we don't
 *                               re-suggest the same ingredient (we suggest
 *                               increasing its grams via the picker instead).
 *                               Pass empty array to keep the recipe items
 *                               in the suggestion list.
 */
export function suggestRemediations(
  rows: AafcoRow[],
  totalDM_g: number,
  excludeIngredientIds: number[] = [],
): GapSuggestion[] {
  const exclude = new Set(excludeIngredientIds);

  const out: GapSuggestion[] = [];
  for (const row of rows) {
    if (row.status !== "below" && row.status !== "borderline") continue;

    const absoluteShortfall = gapToAbsolute(row, totalDM_g);
    if (absoluteShortfall <= 0) continue;

    const nutrientField = row.nutrient.key as keyof Ingredient;

    // ---- Fresh suggestions: top 3 by density excluding already-in-recipe
    const ranked = [...INGREDIENTS]
      .filter((i) => !exclude.has(i.id))
      .map((ing) => {
        const density = (ing[nutrientField] as number) ?? 0;
        if (density <= 0) return null;
        return {
          ingredient: ing,
          densityPer100g: density,
          gramsNeeded: gramsToCloseGap(absoluteShortfall, density),
        };
      })
      .filter((x): x is FreshSuggestion => x !== null)
      .sort((a, b) => a.gramsNeeded - b.gramsNeeded)
      .slice(0, 3);

    // ---- Additive suggestion
    let additive: AdditiveSuggestion | null = null;
    const additiveRecipe = ADDITIVE_BY_NUTRIENT[row.nutrient.key];
    if (additiveRecipe) {
      const ing = INGREDIENT_BY_ID[additiveRecipe.ingredientId];
      if (ing) {
        const density = (ing[additiveRecipe.nutrientField] as number) ?? 0;
        if (density > 0) {
          let grams = gramsToCloseGap(absoluteShortfall, density);
          let capped = false;
          if (additiveRecipe.maxGrams && grams > additiveRecipe.maxGrams) {
            grams = additiveRecipe.maxGrams;
            capped = true;
          }
          additive = {
            ingredient: ing,
            gramsNeeded: grams,
            densityPer100g: density,
            cappedAtMax: capped,
          };
        }
      }
    }

    out.push({ row, absoluteShortfall, fresh: ranked, additive });
  }

  return out;
}

// ----------------------------------------------------------------------------
// B-vitamin complex helper (Wizard step 5)
// ----------------------------------------------------------------------------

/** B vitamins evaluated by the wizard B-complex step. Choline is excluded
 * because it has its own dedicated wizard step. */
export const B_VITAMIN_KEYS = [
  "vit_b1_mg",
  "vit_b2_mg",
  "niacin_mg",
  "vit_b5_mg",
  "vit_b6_mg",
  "folate_mg",
  "vit_b12_ug",
] as const;

export type BVitaminKey = typeof B_VITAMIN_KEYS[number];

export interface BVitaminStatus {
  /** Nutrient field key (matches Ingredient interface). */
  key: BVitaminKey;
  /** AAFCO row for this nutrient (or undefined if no benchmark exists). */
  row: AafcoRow | undefined;
  /** Status: ok | below | borderline | above | no_target. */
  status: AafcoRow["status"] | "no_target";
  /** Absolute shortfall in source unit (mg or μg) for the whole recipe. */
  shortfall: number;
  /** Grams of brewer's yeast needed to close THIS vitamin's gap on its own. */
  yeastGramsToFix: number;
}

export interface BComplexReport {
  perVitamin: BVitaminStatus[];
  /** True if every B vitamin is at or above its AAFCO min. */
  allMet: boolean;
  /** Number of B vitamins currently below or borderline. */
  belowCount: number;
  /** Recommended grams of brewer's yeast to add — covers the WORST gap, but
   * capped at 2% of total recipe weight (or `recipeGramsCap`). */
  recommendedYeastGrams: number;
  /** True if the recommendation hit the 2% cap (i.e. yeast alone won't fully fix). */
  cappedAt2Pct: boolean;
  /** The 2% ceiling actually used (grams). */
  yeastCap_g: number;
}

/**
 * Inspect the AAFCO comparison for the seven B vitamins and produce a single
 * recommendation: how much brewer's yeast (id 157) to add, capped at 2% of
 * total recipe weight.
 *
 * @param rows           the live AAFCO comparison output
 * @param totalDM_g      recipe dry matter (g) — needed to convert per-kg-DM
 *                       deficits into absolute amounts
 * @param totalRecipe_g  recipe total weight (g) — used to compute the 2% ceiling
 */
export function bComplexReport(
  rows: AafcoRow[],
  totalDM_g: number,
  totalRecipe_g: number,
): BComplexReport {
  const yeast = INGREDIENT_BY_ID[157]; // Brewer's yeast
  const yeastCap = Math.max(0, totalRecipe_g) * 0.02;

  const perVitamin: BVitaminStatus[] = B_VITAMIN_KEYS.map((key) => {
    const row = rows.find((r) => r.nutrient.key === key);
    if (!row) {
      return {
        key,
        row: undefined,
        status: "no_target" as const,
        shortfall: 0,
        yeastGramsToFix: 0,
      };
    }
    const shortfall = gapToAbsolute(row, totalDM_g);
    let yeastGramsToFix = 0;
    if (shortfall > 0 && yeast) {
      const density = (yeast[key as keyof Ingredient] as number) ?? 0;
      yeastGramsToFix = density > 0 ? gramsToCloseGap(shortfall, density) : Infinity;
    }
    return {
      key,
      row,
      status: row.status,
      shortfall,
      yeastGramsToFix,
    };
  });

  const belowCount = perVitamin.filter(
    (v) => v.status === "below" || v.status === "borderline",
  ).length;
  const allMet = belowCount === 0 && perVitamin.some((v) => v.row !== undefined);

  // Worst gap = largest grams-to-fix among unmet vitamins (ignore Infinity entries).
  const finiteGaps = perVitamin
    .filter((v) => v.status === "below" || v.status === "borderline")
    .map((v) => v.yeastGramsToFix)
    .filter((g) => Number.isFinite(g));
  const worstFix = finiteGaps.length > 0 ? Math.max(...finiteGaps) : 0;

  let recommended = worstFix;
  let capped = false;
  if (recommended > yeastCap) {
    recommended = yeastCap;
    capped = true;
  }
  // Floor a tiny positive recommendation so we don't show 0.0 g for a real gap.
  if (worstFix > 0 && recommended < 0.1) recommended = Math.min(0.1, yeastCap);

  return {
    perVitamin,
    allMet,
    belowCount,
    recommendedYeastGrams: recommended,
    cappedAt2Pct: capped,
    yeastCap_g: yeastCap,
  };
}

/**
 * Format the additive's "grams needed" for display. Rounds to 0.1 g granularity
 * but never below 0.1 g (so we don't show 0.0 g for a real shortfall).
 */
export function formatGrams(grams: number): string {
  if (!Number.isFinite(grams)) return "—";
  if (grams >= 100) return grams.toFixed(0);
  if (grams >= 10) return grams.toFixed(1);
  if (grams >= 1) return grams.toFixed(2);
  return Math.max(grams, 0.1).toFixed(2);
}
