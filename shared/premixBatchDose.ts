/**
 * Premix dose scaling for a batch recipe.
 *
 * The customer-facing dose is fixed in whole sachets per day (see sachetDose.ts).
 * But a recipe batch may cover any number of days. To keep the per-kcal nutrient
 * ratio constant — which is what AAFCO compliance is measured against — the
 * premix grams in the batch must scale with how many days of food the batch
 * actually represents.
 *
 *   premixGrams = sachetsPerDay × SACHET_GRAMS × (batchGrams / dailyFeedGrams)
 *
 * The right-hand side reduces to (sachetsPerDay × SACHET_GRAMS) / dailyFeedGrams
 * when expressed as a fraction of the batch — i.e. the per-day ratio is
 * preserved regardless of batch size, which is what we want.
 */

export const SACHET_GRAMS = 5;

export interface PremixBatchInput {
  /** Whole sachets per day for this pet (from computeSachetDose). */
  sachetsPerDay: number;
  /** Total weight of fresh food + premix in the batch (g). */
  batchGrams: number;
  /** Daily feeding amount estimated from DER and recipe density (g/day). */
  dailyFeedGrams: number;
}

export interface PremixBatchOutput {
  /** Premix grams to put in this batch (float, NOT rounded to whole sachets). */
  premixGrams: number;
  /** Number of days this batch covers at the given daily feed amount. */
  days: number;
  /** Equivalent number of sachets in the batch (premixGrams / SACHET_GRAMS). */
  sachetsInBatch: number;
  /** Soft warnings the UI can surface. */
  warnings: PremixBatchWarning[];
}

export type PremixBatchWarning =
  | "batch-too-small"   // days < 0.5 — premix < 1.5g, hard to measure accurately
  | "batch-too-large"   // days > 10  — fridge risk + appetite drift
  | "no-fresh-food"     // batchGrams ≈ 0 (only the premix) — invalid recipe
  | "premix-too-heavy"; // premix > 10% of batch — recipe is mostly supplement

/**
 * Compute the premix grams that should sit in a batch given its total weight
 * and the pet's daily feeding amount. Returns 0 grams (with warnings) for
 * degenerate inputs so callers don't have to guard.
 */
export function computePremixBatch(input: PremixBatchInput): PremixBatchOutput {
  const { sachetsPerDay, batchGrams, dailyFeedGrams } = input;
  const warnings: PremixBatchWarning[] = [];

  // Guard: cannot scale by daily feed if it's zero or unknown.
  if (dailyFeedGrams <= 0 || batchGrams < 0 || sachetsPerDay <= 0) {
    return {
      premixGrams: 0,
      days: 0,
      sachetsInBatch: 0,
      warnings: ["no-fresh-food"],
    };
  }

  const days = batchGrams / dailyFeedGrams;
  const premixGrams = sachetsPerDay * SACHET_GRAMS * days;
  const sachetsInBatch = premixGrams / SACHET_GRAMS;

  if (days < 0.5) warnings.push("batch-too-small");
  if (days > 10) warnings.push("batch-too-large");

  // premix-too-heavy: more than 10% of the batch is premix.
  if (batchGrams > 0 && premixGrams / batchGrams > 0.1) {
    warnings.push("premix-too-heavy");
  }

  // no-fresh-food: batch is essentially just the premix (95%+).
  if (batchGrams > 0 && premixGrams / batchGrams >= 0.95) {
    warnings.push("no-fresh-food");
  }

  return { premixGrams, days, sachetsInBatch, warnings };
}
