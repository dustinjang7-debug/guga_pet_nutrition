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

// ============================================================================
// Calcium : Phosphorus ratio
// ============================================================================
//
// AAFCO and NRC both flag Ca:P balance as the single most important mineral
// ratio in homemade pet food. Imbalances cause secondary nutritional
// hyperparathyroidism in growing dogs/cats.
//
//   AAFCO Ca:P (adult dog):    1.0 : 1  to  2.0 : 1
//   AAFCO Ca:P (growth dog):   1.0 : 1  to  1.8 : 1
//   AAFCO Ca:P (adult cat):    0.9 : 1  to  2.0 : 1
//
// The clinically preferred "golden range" used by GUGA is 1.2 : 1 – 1.4 : 1,
// inside the AAFCO band but tighter for everyday formulation.

export type CaPRatioStatus =
  | "empty"      // no Ca or P data yet
  | "golden"    // 1.2–1.4 : 1 (preferred)
  | "ok"        // inside AAFCO band but outside golden
  | "low"       // ratio < AAFCO min
  | "high";     // ratio > AAFCO max

export interface CaPRatio {
  ratio: number;          // Ca / P (unitless)
  status: CaPRatioStatus;
  goldenMin: number;      // 1.2
  goldenMax: number;      // 1.4
  aafcoMin: number;       // species-aware
  aafcoMax: number;       // species-aware
  calcium_mg: number;
  phosphorus_mg: number;
}

/**
 * Compute the Ca:P ratio for a recipe and classify it against AAFCO bands.
 * `species` and `isGrowth` widen/narrow the AAFCO acceptable range.
 */
export function caPhosphorusRatio(
  totals: NutrientTotals,
  species: Species = "dog",
  isGrowth = false,
): CaPRatio {
  const goldenMin = 1.2;
  const goldenMax = 1.4;
  // AAFCO acceptable bands (the lower bound varies by species, upper by stage)
  let aafcoMin: number;
  let aafcoMax: number;
  if (species === "cat") {
    aafcoMin = 0.9;
    aafcoMax = 2.0;
  } else {
    aafcoMin = 1.0;
    aafcoMax = isGrowth ? 1.8 : 2.0;
  }

  const ca = totals.calcium_mg;
  const p = totals.phosphorus_mg;

  if (ca <= 0 || p <= 0) {
    return {
      ratio: 0,
      status: "empty",
      goldenMin, goldenMax, aafcoMin, aafcoMax,
      calcium_mg: ca, phosphorus_mg: p,
    };
  }
  const ratio = ca / p;
  let status: CaPRatioStatus;
  if (ratio < aafcoMin) status = "low";
  else if (ratio > aafcoMax) status = "high";
  else if (ratio >= goldenMin && ratio <= goldenMax) status = "golden";
  else status = "ok";
  return { ratio, status, goldenMin, goldenMax, aafcoMin, aafcoMax, calcium_mg: ca, phosphorus_mg: p };
}

// ============================================================================
// Full nutrient profile (for the Excel-style summary table)
// ============================================================================
//
// One row per nutrient column in the DB, with TOTAL + per-kg-DM + per-1000-kcal
// presentation values. This mirrors the user's reference Excel layout
// (营养成分总含量) and is rendered by SummaryCard's "View full nutrient profile"
// dialog.

export type NutrientGroup =
  | "macro"
  | "energy"
  | "fiber_other"
  | "vitamin"
  | "mineral";

export interface NutrientCatalogEntry {
  key: keyof NutrientTotals;
  label_en: string;
  label_zh: string;
  label_th: string;
  unit: "g" | "mg" | "ug" | "kcal";
  group: NutrientGroup;
}

/**
 * Display order + i18n labels for every nutrient column in the DB.
 * If you add a column to `Ingredient`, add it here too.
 */
export const NUTRIENT_CATALOG: NutrientCatalogEntry[] = [
  // Macros
  { key: "water_g",         label_en: "Water",          label_zh: "水分",       label_th: "น้ำ",           unit: "g",   group: "macro" },
  { key: "energy_kcal",     label_en: "Energy",         label_zh: "能量",       label_th: "พลังงาน",       unit: "kcal",group: "energy" },
  { key: "protein_g",       label_en: "Protein",        label_zh: "蛋白质",     label_th: "โปรตีน",        unit: "g",   group: "macro" },
  { key: "fat_g",           label_en: "Fat",            label_zh: "脂肪",       label_th: "ไขมัน",         unit: "g",   group: "macro" },
  { key: "carb_g",          label_en: "Carbohydrate",   label_zh: "碳水化合物", label_th: "คาร์โบไฮเดรต", unit: "g",   group: "macro" },
  { key: "fiber_g",         label_en: "Dietary fiber",  label_zh: "膳食纤维",   label_th: "ใยอาหาร",       unit: "g",   group: "fiber_other" },
  { key: "cholesterol_mg",  label_en: "Cholesterol",    label_zh: "胆固醇",     label_th: "คอเลสเตอรอล",   unit: "mg",  group: "fiber_other" },

  // Vitamins
  { key: "vit_a_re_ug",     label_en: "Vitamin A (RE)", label_zh: "维生素A",    label_th: "วิตามินเอ",     unit: "ug",  group: "vitamin" },
  { key: "vit_b1_mg",       label_en: "Vitamin B1",     label_zh: "维生素B1",   label_th: "วิตามินบี1",    unit: "mg",  group: "vitamin" },
  { key: "vit_b2_mg",       label_en: "Vitamin B2",     label_zh: "维生素B2",   label_th: "วิตามินบี2",    unit: "mg",  group: "vitamin" },
  { key: "niacin_mg",       label_en: "Vitamin B3 (Niacin)", label_zh: "维生素B3 烟酸", label_th: "วิตามินบี3", unit: "mg",  group: "vitamin" },
  { key: "vit_b5_mg",       label_en: "Vitamin B5",     label_zh: "维生素B5",   label_th: "วิตามินบี5",    unit: "mg",  group: "vitamin" },
  { key: "vit_b6_mg",       label_en: "Vitamin B6",     label_zh: "维生素B6",   label_th: "วิตามินบี6",    unit: "mg",  group: "vitamin" },
  { key: "folate_mg",       label_en: "Folate (B9)",    label_zh: "叶酸 B9",    label_th: "โฟเลต บี9",     unit: "mg",  group: "vitamin" },
  { key: "vit_b12_ug",      label_en: "Vitamin B12",    label_zh: "维生素B12",  label_th: "วิตามินบี12",   unit: "ug",  group: "vitamin" },
  { key: "choline_mg",      label_en: "Choline",        label_zh: "胆碱",       label_th: "โคลีน",         unit: "mg",  group: "vitamin" },
  { key: "vit_c_mg",        label_en: "Vitamin C",      label_zh: "维生素C",    label_th: "วิตามินซี",     unit: "mg",  group: "vitamin" },
  { key: "vit_d_ug",        label_en: "Vitamin D",      label_zh: "维生素D",    label_th: "วิตามินดี",     unit: "ug",  group: "vitamin" },
  { key: "vit_e_mg",        label_en: "Vitamin E",      label_zh: "维生素E",    label_th: "วิตามินอี",     unit: "mg",  group: "vitamin" },

  // Minerals
  { key: "calcium_mg",      label_en: "Calcium",        label_zh: "钙",         label_th: "แคลเซียม",      unit: "mg",  group: "mineral" },
  { key: "phosphorus_mg",   label_en: "Phosphorus",     label_zh: "磷",         label_th: "ฟอสฟอรัส",      unit: "mg",  group: "mineral" },
  { key: "potassium_mg",    label_en: "Potassium",      label_zh: "钾",         label_th: "โพแทสเซียม",    unit: "mg",  group: "mineral" },
  { key: "sodium_mg",       label_en: "Sodium",         label_zh: "钠",         label_th: "โซเดียม",       unit: "mg",  group: "mineral" },
  { key: "magnesium_mg",    label_en: "Magnesium",      label_zh: "镁",         label_th: "แมกนีเซียม",    unit: "mg",  group: "mineral" },
  { key: "iron_mg",         label_en: "Iron",           label_zh: "铁",         label_th: "เหล็ก",         unit: "mg",  group: "mineral" },
  { key: "zinc_mg",         label_en: "Zinc",           label_zh: "锌",         label_th: "สังกะสี",       unit: "mg",  group: "mineral" },
  { key: "selenium_ug",     label_en: "Selenium",       label_zh: "硒",         label_th: "ซีลีเนียม",     unit: "ug",  group: "mineral" },
  { key: "copper_mg",       label_en: "Copper",         label_zh: "铜",         label_th: "ทองแดง",        unit: "mg",  group: "mineral" },
  { key: "manganese_mg",    label_en: "Manganese",      label_zh: "锰",         label_th: "แมงกานีส",      unit: "mg",  group: "mineral" },
];

export interface NutrientProfileRow extends NutrientCatalogEntry {
  total: number;            // value summed across recipe in `unit`
  perKgDM: number;          // value scaled to 1 kg of dry matter (in `unit`)
  per1000kcal: number;      // value per 1000 kcal of metabolizable energy
}

/**
 * Build a per-nutrient table mirroring the user's Excel reference.
 * Rendered by the "View full nutrient profile" dialog.
 */
export function nutrientProfile(
  totals: NutrientTotals,
  macros: RecipeMacros,
): NutrientProfileRow[] {
  const dmKg = macros.totalDryMatter_g / 1000;
  const kcal = macros.totalKcal;
  return NUTRIENT_CATALOG.map((entry) => {
    const total = totals[entry.key] ?? 0;
    const perKgDM = dmKg > 0 ? total / dmKg : 0;
    const per1000kcal = kcal > 0 ? (total / kcal) * 1000 : 0;
    return { ...entry, total, perKgDM, per1000kcal };
  });
}

// ============================================================================
// Carbohydrate kcal share (Wizard carb step gate)
// ============================================================================
//
// AAFCO does not set a carbohydrate minimum, so GUGA uses kcal-share thresholds
// based on the user's clinical preference. % of total kcal coming from carbs is
// computed via Atwater (4 kcal / g carb) and classified per species/stage.
//
//   Dog: optimal 20–30%, ok 30–40%, alert <20% or >40%
//   Cat: optimal <10%,    ok 10–20%, alert  ≥20%
//
// Returned as a record so the UI can show the live % plus the band.

export type CarbKcalStatus = "empty" | "optimal" | "ok" | "alert_low" | "alert_high";

export interface CarbKcalShare {
  carb_g: number;
  carb_kcal: number;
  total_kcal: number;
  pct: number;          // 0–100
  status: CarbKcalStatus;
  optimalMin: number;   // species-specific
  optimalMax: number;
  okMin: number;
  okMax: number;
}

/**
 * Compute carbohydrate share of total kcal (Atwater) and classify against the
 * user's species-specific thresholds.
 */
export function carbKcalShare(
  totals: NutrientTotals,
  species: Species = "dog",
): CarbKcalShare {
  // Per-species bands (see header). For cats the lower bound is open (>=0) so
  // optimalMin = 0; alert_low is not used.
  const bands =
    species === "cat"
      ? { optimalMin: 0, optimalMax: 10, okMin: 10, okMax: 20 }
      : { optimalMin: 20, optimalMax: 30, okMin: 30, okMax: 40 };

  const carb_g = totals.carb_g;
  const carb_kcal = carb_g * 4;
  const total_kcal = totals.energy_kcal;
  if (total_kcal <= 0) {
    return {
      carb_g, carb_kcal, total_kcal: 0, pct: 0, status: "empty",
      ...bands,
    };
  }
  const pct = (carb_kcal / total_kcal) * 100;
  let status: CarbKcalStatus;
  if (species === "cat") {
    if (pct <= bands.optimalMax) status = "optimal";
    else if (pct <= bands.okMax) status = "ok";
    else status = "alert_high";
  } else {
    if (pct < bands.optimalMin) status = "alert_low";
    else if (pct <= bands.optimalMax) status = "optimal";
    else if (pct <= bands.okMax) status = "ok";
    else status = "alert_high";
  }
  return { carb_g, carb_kcal, total_kcal, pct, status, ...bands };
}
