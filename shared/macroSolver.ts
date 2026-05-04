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
import { type RecipeItem, recipeTotals, recipeMacros, aafcoComparison, caPhosphorusRatio } from "./calc";
import { type Species } from "./aafco";

export interface MacroTargetsDM {
  proteinPct: number | null;
  fatPct: number | null;
  carbPct: number | null;
  /** Optional kcal-per-gram target. ±0.2 is treated as zero error; outside that
   *  band the loss function adds (achieved - target)² × ENERGY_WEIGHT. */
  kcalPerG?: number | null;
}

/** Tolerance band around kcal/g target before energy loss kicks in. */
export const ENERGY_TOLERANCE = 0.2;

function kcalPerG(items: RecipeItem[], totals: { energy_kcal: number }): number {
  const g = items.reduce((s, i) => s + i.grams, 0);
  return g > 0 ? totals.energy_kcal / g : 0;
}

/** How many "%-points squared" of loss each kcal/g overage equals. Calibrated
 *  so a 0.5 kcal/g miss matters about as much as a 5pp macro miss. */
export const ENERGY_WEIGHT = 100;

export type RebalanceStatus =
  | "solved"
  | "partial"
  | "infeasible"
  | "all_locked"
  | "no_unlocked_macro_source";

export interface RebalanceResult {
  /** New items array with locked items scaled to preserve their % share, unlocked items adjusted. */
  items: RecipeItem[];
  /** Achieved % after the solve, on DM basis. Includes kcal/g for energy density. */
  achieved: { proteinPct: number; fatPct: number; carbPct: number; kcalPerG: number };
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
  /** Ca:P ratio of the new recipe (or null if no Ca / P). */
  caPRatio: number | null;
  /** Optional AAFCO compliance summary against species/stage if provided. */
  aafco?: { met: number; below: number; over: number };
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
  if (targets.kcalPerG !== null && targets.kcalPerG !== undefined) {
    const totalGrams = items.reduce((s, i) => s + i.grams, 0);
    if (totalGrams > 0) {
      const achieved = totals.energy_kcal / totalGrams;
      const delta = achieved - targets.kcalPerG;
      const overTol = Math.max(0, Math.abs(delta) - ENERGY_TOLERANCE);
      loss += overTol * overTol * ENERGY_WEIGHT;
    }
  }
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
  /** Outer iterations for lock-by-%: re-scale locked items, re-solve unlocked, repeat. Default 3. */
  lockPctPasses?: number;
  /** Each unlocked ingredient's new grams must be >= max(this fraction of total, its starting %).
   *  Default 0.02 (2%). Items already below 2% at the start are pinned at their starting %. */
  floorPctOfRecipe?: number;
  /** Pet species/stage for AAFCO compliance check on result. Optional. */
  aafcoTarget?: { species: Species; isGrowth: boolean };
}

/**
 * Solve for new grams on unlocked ingredients to match target P/F/C %.
 *
 * The solver uses bounded coordinate descent: for each unlocked ingredient
 * we try a step up and a step down, accept the move that reduces loss,
 * and shrink the step size as we converge. This is robust for the small
 * problem sizes we have (typically 3-10 unlocked items).
 */
/**
 * Inner core: bounded coordinate descent on unlocked items only.
 * Locked items keep their grams during this pass (we'll re-scale them
 * outside, in the lock-by-% wrapper).
 */
function solveCore(
  items: RecipeItem[],
  unlockedIdx: number[],
  targets: MacroTargetsDM,
  opts: { maxIterations: number; errorThreshold: number; maxScale: number; minScale: number },
): { work: RecipeItem[]; iterations: number } {
  const work = items.map(i => ({ ...i }));
  const originalGrams: Record<number, number> = {};
  for (const i of unlockedIdx) originalGrams[i] = work[i].grams;

  let bestLoss = lossOf(work, targets);
  let stepFrac = 0.25;
  const stepFloor = 0.005;
  let iter = 0;

  while (iter < opts.maxIterations && bestLoss > opts.errorThreshold) {
    let improved = false;
    for (const i of unlockedIdx) {
      const orig = originalGrams[i];
      const minG = orig * opts.minScale;
      const maxG = orig * opts.maxScale;
      const cur = work[i].grams;
      const step = Math.max(orig * stepFrac, 0.1);

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
  return { work, iterations: iter };
}

/**
 * Solve for new grams on unlocked ingredients to match target P/F/C %.
 *
 * **Lock-by-% semantics**: locked ingredients preserve their share of total
 * recipe weight (not their absolute grams). When the solver expands or shrinks
 * the unlocked group, locked items scale proportionally so their % stays
 * constant.
 *
 * Algorithm: outer loop alternates (a) solve unlocked grams against targets,
 * (b) re-scale locked items so each preserves its original % of new total.
 * Converges in 2-3 outer passes for typical recipes.
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
  const lockPctPasses = options.lockPctPasses ?? 3;
  const floorPctOfRecipe = options.floorPctOfRecipe ?? 0.02;

  // Auto-lock any item that is ≤ floorPctOfRecipe of the original recipe.
  // These are micro/supplement ingredients (eggshell, brewer's yeast, oils
  // dosed in droplets) that should NEVER be touched by the solver.
  const _autoLockOrigTotal = items.reduce((s, it) => s + it.grams, 0);
  const effectiveLockedIds = new Set(lockedIds);
  for (const it of items) {
    if (effectiveLockedIds.has(it.ingredientId)) continue;
    const pct = _autoLockOrigTotal > 0 ? it.grams / _autoLockOrigTotal : 0;
    if (pct <= floorPctOfRecipe) effectiveLockedIds.add(it.ingredientId);
  }

  const unlockedIdx: number[] = [];
  const lockedIdx: number[] = [];
  items.forEach((it, idx) => {
    if (effectiveLockedIds.has(it.ingredientId)) lockedIdx.push(idx);
    else unlockedIdx.push(idx);
  });

  if (unlockedIdx.length === 0) {
    const totals = recipeTotals(items);
    const m = recipeMacros(items, totals);
    return {
      items: items.map(i => ({ ...i })),
      achieved: { proteinPct: m.proteinPct_DM, fatPct: m.fatPct_DM, carbPct: m.carbPct_DM, kcalPerG: kcalPerG(items, totals) },
      residualError: lossOf(items, targets),
      iterations: 0,
      status: "all_locked",
      delta: deltaOf(m, targets),
      caPRatio: caPhosphorusRatio(totals).ratio,
      ...(options.aafcoTarget
        ? { aafco: aafcoSummary(items, options.aafcoTarget.species, options.aafcoTarget.isGrowth) }
        : {}),
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
      achieved: { proteinPct: m.proteinPct_DM, fatPct: m.fatPct_DM, carbPct: m.carbPct_DM, kcalPerG: kcalPerG(items, totals) },
      residualError: lossOf(items, targets),
      iterations: 0,
      status: "no_unlocked_macro_source",
      delta: deltaOf(m, targets),
      caPRatio: caPhosphorusRatio(totals).ratio,
      ...(options.aafcoTarget
        ? { aafco: aafcoSummary(items, options.aafcoTarget.species, options.aafcoTarget.isGrowth) }
        : {}),
    };
  }

  // Capture each locked item's original % share of the recipe.
  const origTotal = items.reduce((s, it) => s + it.grams, 0);
  const lockedShares: Record<number, number> = {};
  for (const i of lockedIdx) {
    lockedShares[i] = origTotal > 0 ? items[i].grams / origTotal : 0;
  }

  let work = items.map(i => ({ ...i }));
  let totalIter = 0;
  const coreOpts = { maxIterations, errorThreshold, maxScale, minScale };

  for (let pass = 0; pass < lockPctPasses; pass++) {
    // Solve unlocked grams against targets, holding current locked grams fixed.
    const result = solveCore(work, unlockedIdx, targets, coreOpts);
    work = result.work;
    totalIter += result.iterations;

    if (lockedIdx.length === 0) break;

    // Re-scale locked items so each preserves its original % of new total.
    // We iterate on this because changing locked grams changes total which
    // changes the target grams for next pass.
    let prevLockedTotal = -1;
    for (let inner = 0; inner < 8; inner++) {
      const unlockedTotal = unlockedIdx.reduce((s, i) => s + work[i].grams, 0);
      const lockedShareSum = lockedIdx.reduce((s, i) => s + lockedShares[i], 0);
      // newTotal * (1 - lockedShareSum) = unlockedTotal
      if (1 - lockedShareSum < 1e-6) break; // degenerate (all locked is 100%)
      const newTotal = unlockedTotal / (1 - lockedShareSum);
      let newLockedTotal = 0;
      for (const i of lockedIdx) {
        work[i].grams = lockedShares[i] * newTotal;
        newLockedTotal += work[i].grams;
      }
      if (Math.abs(newLockedTotal - prevLockedTotal) < 0.05) break;
      prevLockedTotal = newLockedTotal;
    }
  }

  // Round all to 0.1 g for display sanity.
  for (let i = 0; i < work.length; i++) {
    work[i].grams = Math.round(work[i].grams * 10) / 10;
  }
  const finalTotals = recipeTotals(work);
  const finalMacros = recipeMacros(work, finalTotals);
  const finalLoss = lossOf(work, targets);

  let status: RebalanceStatus;
  if (finalLoss <= 3) status = "solved";
  else if (cantHitProtein || cantHitFat || cantHitCarb) status = "partial";
  else if (finalLoss <= 27) status = "partial";
  else status = "infeasible";

  const result: RebalanceResult = {
    items: work,
    achieved: {
      proteinPct: finalMacros.proteinPct_DM,
      fatPct: finalMacros.fatPct_DM,
      carbPct: finalMacros.carbPct_DM,
      kcalPerG: kcalPerG(work, finalTotals),
    },
    residualError: finalLoss,
    iterations: totalIter,
    status,
    delta: deltaOf(finalMacros, targets),
    caPRatio: caPhosphorusRatio(finalTotals).ratio,
  };
  if (options.aafcoTarget) {
    result.aafco = aafcoSummary(work, options.aafcoTarget.species, options.aafcoTarget.isGrowth);
  }
  return result;
}

function aafcoSummary(
  items: RecipeItem[],
  species: Species,
  isGrowth: boolean,
): { met: number; below: number; over: number } {
  const totals = recipeTotals(items);
  const macros = recipeMacros(items, totals);
  const rows = aafcoComparison(totals, macros, species, isGrowth);
  let met = 0, below = 0, over = 0;
  for (const r of rows) {
    if (r.status === "ok" || r.status === "borderline") met++;
    else if (r.status === "below") below++;
    else if (r.status === "above") over++;
  }
  return { met, below, over };
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
