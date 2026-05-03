/**
 * GUGA premix sachet dosing rule.
 *
 * 1 sachet = 5 g. Sachet count snaps to whole sachets per day, scaled by
 * pet body weight. Rule provided by GUGA team:
 *
 *   2.0  – 7.4  kg  -> 1 sachet/day
 *   7.5  – 12.5 kg  -> 2 sachets/day
 *   12.6 – 17.5 kg  -> 3 sachets/day
 *   17.6 – 22.5 kg  -> 4 sachets/day
 *   22.6 – 27.5 kg  -> 5 sachets/day
 *   27.6 – 32.5 kg  -> 6 sachets/day
 *   32.6 – 37.5 kg  -> 7 sachets/day
 *   37.6 – 40.0 kg  -> 8 sachets/day
 *
 *   < 2.0 kg or > 40.0 kg -> not supported.
 *
 * Bumps happen at the midpoint of the next 5-kg bucket so the lower end
 * stays at the safer (smaller) sachet count: a 5.1 kg cat keeps 1 sachet.
 */

export const GRAMS_PER_SACHET = 5;
export const MIN_BODY_WEIGHT_KG = 2;
export const MAX_BODY_WEIGHT_KG = 40;

export type SachetDose =
  | { ok: true; sachets: number; gramsPerDay: number }
  | { ok: false; reason: "below_min" | "above_max" };

export function computeSachetDose(bodyWeightKg: number): SachetDose {
  if (!Number.isFinite(bodyWeightKg)) return { ok: false, reason: "below_min" };
  if (bodyWeightKg < MIN_BODY_WEIGHT_KG)
    return { ok: false, reason: "below_min" };
  if (bodyWeightKg > MAX_BODY_WEIGHT_KG)
    return { ok: false, reason: "above_max" };

  // Boundaries in kg above which the count bumps:
  // 7.5, 12.5, 17.5, 22.5, 27.5, 32.5, 37.5
  // Each boundary = midpoint of two adjacent 5-kg buckets.
  const boundaries = [7.5, 12.5, 17.5, 22.5, 27.5, 32.5, 37.5];
  let sachets = 1;
  for (const b of boundaries) {
    if (bodyWeightKg >= b) sachets += 1;
  }
  return {
    ok: true,
    sachets,
    gramsPerDay: sachets * GRAMS_PER_SACHET,
  };
}

/**
 * For displaying the daily premix grams when designing a recipe.
 * If the recipe is for N days, the recipe's premix grams = sachetsPerDay * 5 * N.
 */
export function premixGramsForRecipe(
  bodyWeightKg: number,
  recipeDays: number,
): number {
  const dose = computeSachetDose(bodyWeightKg);
  if (!dose.ok) return 0;
  return dose.gramsPerDay * Math.max(1, Math.round(recipeDays));
}
