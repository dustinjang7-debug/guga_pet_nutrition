/**
 * GUGA Pet Nutrition — Recipe Calculation Engine
 *
 * Pure functions, no side effects. Same code runs on server and client so
 * recipe math is identical everywhere (e.g., when re-rendering a saved recipe).
 */

import { INGREDIENT_BY_ID, type Ingredient } from "./ingredients";
import {
  AAFCO_CAT,
  AAFCO_DOG,
  ATWATER,
  type AafcoNutrient,
  type Species,
  der,
  waterFromBodyWeight,
  waterFromEnergy,
} from "./aafco";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface RecipeItem {
  ingredientId: number;
  grams: number;
}

/** All numeric nutrient totals for the recipe. Per recipe, not per 100 g. */
export interface NutrientTotals {
  water_g: number;
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fiber_g: number;
  cholesterol_mg: number;
  vit_a_re_ug: number;
  vit_b1_mg: number;
  vit_b2_mg: number;
  niacin_mg: number;
  vit_b5_mg: number;
  vit_b6_mg: number;
  folate_mg: number;
  vit_b12_ug: number;
  choline_mg: number;
  vit_c_mg: number;
  vit_d_ug: number;
  vit_e_mg: number;
  calcium_mg: number;
  phosphorus_mg: number;
  potassium_mg: number;
  sodium_mg: number;
  magnesium_mg: number;
  iron_mg: number;
  zinc_mg: number;
  selenium_ug: number;
  copper_mg: number;
  manganese_mg: number;
}

const NUTRIENT_KEYS: (keyof NutrientTotals)[] = [
  "water_g", "energy_kcal", "protein_g", "fat_g", "carb_g", "fiber_g",
  "cholesterol_mg", "vit_a_re_ug", "vit_b1_mg", "vit_b2_mg", "niacin_mg",
  "vit_b5_mg", "vit_b6_mg", "folate_mg", "vit_b12_ug", "choline_mg",
  "vit_c_mg", "vit_d_ug", "vit_e_mg", "calcium_mg", "phosphorus_mg",
  "potassium_mg", "sodium_mg", "magnesium_mg", "iron_mg", "zinc_mg",
  "selenium_ug", "copper_mg", "manganese_mg",
];

function blankTotals(): NutrientTotals {
  return NUTRIENT_KEYS.reduce((acc, k) => {
    acc[k] = 0;
    return acc;
  }, {} as NutrientTotals);
}

// ----------------------------------------------------------------------------
// Totals
// ----------------------------------------------------------------------------

/** Sum nutrients across all ingredients in the recipe. */
export function recipeTotals(items: RecipeItem[]): NutrientTotals {
  const totals = blankTotals();
  for (const item of items) {
    const ing = INGREDIENT_BY_ID[item.ingredientId];
    if (!ing) continue;
    const factor = item.grams / 100; // values stored per 100 g
    for (const key of NUTRIENT_KEYS) {
      totals[key] += (ing[key as keyof Ingredient] as number) * factor;
    }
  }
  return totals;
}

export interface RecipeMacros {
  totalGrams: number;
  totalKcal: number;
  totalDryMatter_g: number;
  totalWater_g: number;
  energyDensity_kcal_per_g: number;
  moisturePct: number;
  /** Macro % on DM basis. */
  proteinPct_DM: number;
  fatPct_DM: number;
  carbPct_DM: number;
  /** Macro % on ME basis. */
  proteinPct_ME: number;
  fatPct_ME: number;
  carbPct_ME: number;
}

export function recipeMacros(items: RecipeItem[], totals: NutrientTotals): RecipeMacros {
  const totalGrams = items.reduce((s, i) => s + i.grams, 0);
  const totalKcal = totals.energy_kcal;
  const totalWater = totals.water_g;
  const totalDM = Math.max(totalGrams - totalWater, 0);
  const moisturePct = totalGrams > 0 ? (totalWater / totalGrams) * 100 : 0;
  const energyDensity = totalGrams > 0 ? totalKcal / totalGrams : 0;

  const proteinDM = totalDM > 0 ? (totals.protein_g / totalDM) * 100 : 0;
  const fatDM = totalDM > 0 ? (totals.fat_g / totalDM) * 100 : 0;
  const carbDM = totalDM > 0 ? (totals.carb_g / totalDM) * 100 : 0;

  const pKcal = totals.protein_g * ATWATER.protein;
  const fKcal = totals.fat_g * ATWATER.fat;
  const cKcal = totals.carb_g * ATWATER.carb;
  const meKcal = pKcal + fKcal + cKcal;
  const proteinME = meKcal > 0 ? (pKcal / meKcal) * 100 : 0;
  const fatME = meKcal > 0 ? (fKcal / meKcal) * 100 : 0;
  const carbME = meKcal > 0 ? (cKcal / meKcal) * 100 : 0;

  return {
    totalGrams,
    totalKcal,
    totalDryMatter_g: totalDM,
    totalWater_g: totalWater,
    energyDensity_kcal_per_g: energyDensity,
    moisturePct,
    proteinPct_DM: proteinDM,
    fatPct_DM: fatDM,
    carbPct_DM: carbDM,
    proteinPct_ME: proteinME,
    fatPct_ME: fatME,
    carbPct_ME: carbME,
  };
}

// ----------------------------------------------------------------------------
// AAFCO comparison
// ----------------------------------------------------------------------------

export type AafcoStatus = "below" | "borderline" | "ok" | "above" | "no_target";

export interface AafcoRow {
  nutrient: AafcoNutrient;
  /** Total in recipe (in the source ingredient unit, e.g. mg). */
  totalInRecipe: number;
  /** Per kg dry matter, in the AAFCO display unit (matches `unit` of the row). */
  perKgDM: number;
  /** Per 1000 kcal ME. */
  per1000kcal: number;
  status: AafcoStatus;
  min: number | null;
  max: number | null;
  /** Delta to nearest bound; useful for "Suggest fix". */
  delta: number;
}

/**
 * Convert a totals value to "per kg DM" in AAFCO display units.
 * Source nutrient is per recipe in mg / μg / g (per `_g`, `_mg`, `_ug` suffix).
 * AAFCO unit is one of: g/kg DM, mg/kg DM, μg/kg DM.
 */
function convertToPerKgDM(totalInRecipe: number, nutrientKey: string, totalDM_g: number, displayUnit: string): number {
  if (totalDM_g <= 0) return 0;
  // recipe total per kg DM:
  const perKg = totalInRecipe / (totalDM_g / 1000);
  // No conversion needed because we keep the source key's unit and the AAFCO row's unit aligned.
  // For protein/fat/carb the source is g and AAFCO unit is g/kg DM → identical.
  // For minerals like Ca, source is mg, AAFCO row says g/kg DM → divide by 1000.
  if (displayUnit.startsWith("g/kg") && nutrientKey.endsWith("_mg")) return perKg / 1000;
  return perKg;
}

function convertToPer1000kcal(totalInRecipe: number, totalKcal: number, displayUnit: string, nutrientKey: string): number {
  if (totalKcal <= 0) return 0;
  const per1000 = (totalInRecipe / totalKcal) * 1000;
  if (displayUnit.startsWith("g/kg") && nutrientKey.endsWith("_mg")) return per1000 / 1000;
  return per1000;
}

export function aafcoComparison(
  totals: NutrientTotals,
  macros: RecipeMacros,
  species: Species,
  isGrowth: boolean,
): AafcoRow[] {
  const profile = species === "dog" ? AAFCO_DOG : AAFCO_CAT;
  const out: AafcoRow[] = [];

  for (const n of profile) {
    const totalInRecipe = (totals as unknown as Record<string, number>)[n.key] ?? 0;
    const perKgDM = convertToPerKgDM(totalInRecipe, n.key, macros.totalDryMatter_g, n.unit);
    const per1000kcal = convertToPer1000kcal(totalInRecipe, macros.totalKcal, n.unit, n.key);

    const min = isGrowth ? n.growthMin : n.adultMin;
    const max = n.max;

    let status: AafcoStatus = "no_target";
    let delta = 0;

    if (min !== null) {
      if (perKgDM < min) {
        status = "below";
        delta = min - perKgDM;
      } else if (perKgDM < min * 1.1) {
        status = "borderline";
        delta = min * 1.1 - perKgDM;
      } else if (max !== null && perKgDM > max) {
        status = "above";
        delta = perKgDM - max;
      } else {
        status = "ok";
        delta = 0;
      }
    } else if (max !== null && perKgDM > max) {
      status = "above";
      delta = perKgDM - max;
    }

    out.push({
      nutrient: n,
      totalInRecipe,
      perKgDM,
      per1000kcal,
      status,
      min,
      max,
      delta,
    });
  }

  return out;
}

// ----------------------------------------------------------------------------
// Daily feeding
// ----------------------------------------------------------------------------

export interface DailyFeed {
  derKcal: number;
  feedingGrams: number;
  waterFromEnergy_mL: number;
  waterFromBodyWeight_mL: number;
  waterFromFood_mL: number;
  waterStillNeeded_mL: number;
}

export function dailyFeed(
  bodyWeightKg: number,
  lifeStageFactor: number,
  macros: RecipeMacros,
): DailyFeed {
  const derKcal = der(bodyWeightKg, lifeStageFactor);
  const feedingGrams = macros.energyDensity_kcal_per_g > 0 ? derKcal / macros.energyDensity_kcal_per_g : 0;
  const waterEnergy = waterFromEnergy(derKcal);
  const waterBW = waterFromBodyWeight(bodyWeightKg);
  // water from food = moisture % × feeding grams (1 g water = 1 mL)
  const waterFromFood = (macros.moisturePct / 100) * feedingGrams;
  const stillNeeded = Math.max(waterEnergy - waterFromFood, 0);
  return {
    derKcal,
    feedingGrams,
    waterFromEnergy_mL: waterEnergy,
    waterFromBodyWeight_mL: waterBW,
    waterFromFood_mL: waterFromFood,
    waterStillNeeded_mL: stillNeeded,
  };
}
