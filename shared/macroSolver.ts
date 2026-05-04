/**
 * GUGA Pet Nutrition — Macro Rebalance Solver
 *
 * Given a saved recipe, target P/F/C % (DM basis), and a set of locked
 * ingredients, the solver finds new gram amounts for the *unlocked*
 * ingredients that minimise the squared error against the targets while
 * keeping all grams non-negative.
 *
 * Approach
 * --------
 * Bounded coordinate-descent (Gauss-Seidel-style) with line search. We do
 * NOT try to be a real LP/QP solver here — the search space is small
 * (≤ ~15 unlocked ingredients × 3 macro targets), and a few hundred
 * coordinate sweeps converge well within 100 ms on a phone.
 *
 * Loss function
 * -------------
 * For each candidate solution we compute the recipe macros via the same
 * `recipeMacros` used everywhere else, then sum:
 *
 *     (P_DM − P_target)² + (F_DM − F_target)² + (C_DM − C_target)²
 *
 * Each component weighted equally; if a target is `null` it's dropped.
 *
 * Locks
 * -----
 * Locked ingredients keep their original grams exactly. The solver only
 * adjusts unlocked grams. If every ingredient is locked the solver
 * returns the original items unchanged with status="all_locked".
 */

import { INGREDIENT_BY_ID } from "./ingredients";
import { type RecipeItem, recipeTotals, recipeMacros } from "./calc";

export interface MacroTargetsDM {
  proteinPct: number | null;
  fatPct: number | null;
  carbPct: number | null;
}

export type RebalanceStatus =
  | "solved"
  | "partial"
  | "infeasible"
  | "all_locked"
  | "no_unlocked_macro_source";

export interface RebalanceResult {
  /** New items array with unlocked grams adjusted; locked grams unchanged. */
  items: RecipeItem[];
  /** Achieved % after the solve, on DM basis. */
  achieved: { proteinPct: number; fatPct: number; carbPct: number };
  /** Sum of squared % errors at the final solution. */
  residualError: number;
  /** Iterations used (for diagnostics). */
  iterations: number;
  status: RebalanceStatus;
  /** Per-target % point delta vs. target (achieved - target). */
  delta: {
    proteinPct: number | null;
    fatPct: number | null;
    carbPct: number | null;
  };
}

/**
 * Compute squared % error against the targets.
 */
function lossOf(items: RecipeItem[], targets: MacroTargetsDM): number {
  const totals = recipeTotals(items);
  const m = recipeMacros(items, totals);
  let loss = 0;
  if (targets.proteinPct !== null) loss += (m.proteinPct_DM - targets.proteinPct) ** 2;
  if (targets.fatPct !== null) loss += (m.fatPct_DM - targets.fatPct) ** 2;
  if (targets.carbPct !== null) loss += (m.carbPct_DM - targets.carbPct) ** 2;
  return loss;
}

/**
 * Identify which macro roles each unlocked ingredient can contribute to.
 * Used to detect the "no fat source" infeasibility case up front.
 */
function inventoryUnlockedRoles(
  items: RecipeItem[],
  unlockedIdx: number[],
): { hasProtein: boolean; hasFat: boolean; hasCarb: boolean } {
  let hasProtein = false;
  let hasFat = false;
  let hasCarb = false;
  for (const i of unlockedIdx) {
    const ing = INGREDIENT_BY_ID[items[i].ingredientId];
    if (!ing) continue;
    if (ing.protein_g > 1) hasProtein = true;
    if (ing.fat_g > 1) hasFat = true;
    if (ing.carb_g > 1) hasCarb = true;
  }
  return { hasProtein, hasFat, hasCarb };
}

export interface RebalanceOptions {
  /** Maximum coordinate-descent sweeps. Default 200. */
  maxIterations?: number;
  /** Stop when squared error drops below this. Default 1.0 (≈ ±0.6 pp per macro avg).
   *  Status "solved" is also reported when total squared error stays under 3.0
   *  (≈ ±1pp per macro avg) which is well within ingredient-data precision. */
  errorThreshold?: number;
  /** Cap each unlocked ingredient at this multiple of its original grams.
   *  Default 5x — prevents the solver from inflating one ingredient absurdly. */
  maxScale?: number;
  /** Floor each unlocked ingredient at this multiple of its original grams.
   *  Default 0.05 — ingredients can shrink to 5% of original but not vanish. */
  minScale?: number;
}

/**
 * Solve for new grams on unlocked ingredients to match target P/F/C %.
 *
 * The solver uses bounded coordinate descent: for each unlocked ingredient
 * we try a step up and a step down, accept the move that reduces loss,
 * and shrink the step size as we converge. This is robust for the small
 * problem sizes we have (typically 3-10 unlocked items).
 */
export function solveRebalance(
  items: RecipeItem[],
  lockedIds: Set<number>,
  targets: MacroTargetsDM,
  options: RebalanceOptions = {},
): RebalanceResult {
  const maxIterations = options.maxIterations ?? 200;
  const errorThreshold = options.errorThreshold ?? 1.0;
  const maxScale = options.maxScale ?? 5;
  const minScale = options.minScale ?? 0.05;

  const unlockedIdx: number[] = [];
  items.forEach((it, idx) => {
    if (!lockedIds.has(it.ingredientId)) unlockedIdx.push(idx);
  });

  if (unlockedIdx.length === 0) {
    const totals = recipeTotals(items);
    const m = recipeMacros(items, totals);
    return {
      items: items.map(i => ({ ...i })),
      achieved: { proteinPct: m.proteinPct_DM, fatPct: m.fatPct_DM, carbPct: m.carbPct_DM },
      residualError: lossOf(items, targets),
      iterations: 0,
      status: "all_locked",
      delta: deltaOf(m, targets),
    };
  }

  const roles = inventoryUnlockedRoles(items, unlockedIdx);
  const cantHitProtein = targets.proteinPct !== null && targets.proteinPct > 0 && !roles.hasProtein;
  const cantHitFat = targets.fatPct !== null && targets.fatPct > 0 && !roles.hasFat;
  const cantHitCarb = targets.carbPct !== null && targets.carbPct > 0 && !roles.hasCarb;
  const allRolesMissing = cantHitProtein && cantHitFat && cantHitCarb;
  if (allRolesMissing) {
    const totals = recipeTotals(items);
    const m = recipeMacros(items, totals);
    return {
      items: items.map(i => ({ ...i })),
      achieved: { proteinPct: m.proteinPct_DM, fatPct: m.fatPct_DM, carbPct: m.carbPct_DM },
      residualError: lossOf(items, targets),
      iterations: 0,
      status: "no_unlocked_macro_source",
      delta: deltaOf(m, targets),
    };
  }

  // Working copy (deep-copied so we never mutate caller's items).
  const work = items.map(i => ({ ...i }));
  const originalGrams: Record<number, number> = {};
  for (const i of unlockedIdx) originalGrams[i] = work[i].grams;

  let bestLoss = lossOf(work, targets);

  // Initial step size: 25% of original grams. Halve when no improvement.
  let stepFrac = 0.25;
  const stepFloor = 0.005; // 0.5% — finer than this is noise
  let iter = 0;

  while (iter < maxIterations && bestLoss > errorThreshold) {
    let improved = false;
    for (const i of unlockedIdx) {
      const orig = originalGrams[i];
      const minG = orig * minScale;
      const maxG = orig * maxScale;
      const cur = work[i].grams;
      const step = Math.max(orig * stepFrac, 0.1);

      // Try up
      const up = Math.min(maxG, cur + step);
      if (up !== cur) {
        work[i].grams = up;
        const lossUp = lossOf(work, targets);
        if (lossUp < bestLoss - 1e-6) {
          bestLoss = lossUp;
          improved = true;
          continue;
        }
        work[i].grams = cur;
      }

      // Try down
      const down = Math.max(minG, cur - step);
      if (down !== cur) {
        work[i].grams = down;
        const lossDown = lossOf(work, targets);
        if (lossDown < bestLoss - 1e-6) {
          bestLoss = lossDown;
          improved = true;
          continue;
        }
        work[i].grams = cur;
      }
    }
    iter++;
    if (!improved) {
      stepFrac *= 0.5;
      if (stepFrac < stepFloor) break;
    }
  }

  // Round to 0.1 g for display sanity. We re-evaluate loss on the rounded
  // values so the reported achieved % matches what the UI will show.
  for (const i of unlockedIdx) {
    work[i].grams = Math.round(work[i].grams * 10) / 10;
  }
  const finalTotals = recipeTotals(work);
  const finalMacros = recipeMacros(work, finalTotals);
  const finalLoss = lossOf(work, targets);

  // Status thresholds (squared % error across the up-to-3 active targets):
  //   solved   : loss <= 3   ≈ ~1pp per macro on average
  //   partial  : loss <= 27  ≈ ~3pp per macro average
  //   infeasible : worse than that
  let status: RebalanceStatus;
  if (finalLoss <= 3) status = "solved";
  else if (cantHitProtein || cantHitFat || cantHitCarb) status = "partial";
  else if (finalLoss <= 27) status = "partial";
  else status = "infeasible";

  return {
    items: work,
    achieved: {
      proteinPct: finalMacros.proteinPct_DM,
      fatPct: finalMacros.fatPct_DM,
      carbPct: finalMacros.carbPct_DM,
    },
    residualError: finalLoss,
    iterations: iter,
    status,
    delta: deltaOf(finalMacros, targets),
  };
}

function deltaOf(
  m: { proteinPct_DM: number; fatPct_DM: number; carbPct_DM: number },
  targets: MacroTargetsDM,
): { proteinPct: number | null; fatPct: number | null; carbPct: number | null } {
  return {
    proteinPct: targets.proteinPct === null ? null : m.proteinPct_DM - targets.proteinPct,
    fatPct: targets.fatPct === null ? null : m.fatPct_DM - targets.fatPct,
    carbPct: targets.carbPct === null ? null : m.carbPct_DM - targets.carbPct,
  };
}
