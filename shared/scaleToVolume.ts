/**
 * Proportional scale of all recipe items to a target total weight.
 *
 * Used by the Current Recipe panel when every row is locked: at that point
 * pro-rata rebalancing has nowhere to send slack, so the only meaningful
 * action is to rescale the whole thing to a fresh canonical total (1000 g).
 *
 * Pure / framework-free so it can be vitest-covered without DOM mocks.
 */

import type { RecipeItem } from "./calc";

export function scaleToVolume(
  items: RecipeItem[],
  targetGrams: number,
): RecipeItem[] {
  if (items.length === 0 || targetGrams <= 0) return items;
  const total = items.reduce((s, it) => s + Math.max(0, it.grams), 0);
  if (total <= 0) return items;
  const factor = targetGrams / total;
  return items.map((it) => ({
    ...it,
    grams: Math.max(0, it.grams) * factor,
  }));
}
