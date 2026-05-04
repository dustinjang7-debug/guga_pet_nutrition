import { describe, expect, it } from "vitest";
import { solveRebalance } from "../shared/macroSolver";
import { recipeTotals, recipeMacros } from "../shared/calc";

// Pick stable ingredient ids that exist in the seed DB. We use simple,
// long-stable USDA entries: chicken breast, salmon, sweet potato, oat.
// If any of these get renumbered the test will fail loudly.
const CHICKEN_BREAST_ID = 65;
const SALMON_ID = 133;
const SWEET_POTATO_ID = 27;
const OAT_ID = 9;
const SALMON_OIL_ID = 247; // for fat-only test

describe("solveRebalance", () => {
  it("hits protein/fat/carb targets within tolerance for a 5-ingredient recipe", () => {
    const items = [
      { ingredientId: CHICKEN_BREAST_ID, grams: 200 },
      { ingredientId: SALMON_ID, grams: 50 },
      { ingredientId: SWEET_POTATO_ID, grams: 100 },
      { ingredientId: OAT_ID, grams: 30 },
      { ingredientId: SALMON_OIL_ID, grams: 5 },
    ];
    const targets = { proteinPct: 45, fatPct: 25, carbPct: 25 };
    const r = solveRebalance(items, new Set(), targets);
    expect(r.status).toBe("solved");
    expect(Math.abs(r.achieved.proteinPct - 45)).toBeLessThan(2);
    expect(Math.abs(r.achieved.fatPct - 25)).toBeLessThan(2);
    expect(Math.abs(r.achieved.carbPct - 25)).toBeLessThan(2);
    // All grams should be positive and reasonable.
    for (const it of r.items) expect(it.grams).toBeGreaterThan(0);
  });

  it("locks ingredients by % share of recipe (grams scale with new total)", () => {
    const items = [
      { ingredientId: CHICKEN_BREAST_ID, grams: 200 },
      { ingredientId: SALMON_ID, grams: 50 },
      { ingredientId: SWEET_POTATO_ID, grams: 100 },
    ];
    const origTotal = 350;
    const sweetOrigShare = 100 / origTotal; // ~28.57%
    const locked = new Set([SWEET_POTATO_ID]);
    const targets = { proteinPct: 50, fatPct: 30, carbPct: 15 };
    const r = solveRebalance(items, locked, targets);
    const sweet = r.items.find(i => i.ingredientId === SWEET_POTATO_ID)!;
    const newTotal = r.items.reduce((s, i) => s + i.grams, 0);
    const newShare = sweet.grams / newTotal;
    // Allow 1pp tolerance for rounding to 0.1g
    expect(Math.abs(newShare - sweetOrigShare)).toBeLessThan(0.01);
  });

  it("preserves multiple locked items' % shares simultaneously", () => {
    const items = [
      { ingredientId: CHICKEN_BREAST_ID, grams: 200 },
      { ingredientId: SALMON_ID, grams: 50 },
      { ingredientId: SWEET_POTATO_ID, grams: 100 },
      { ingredientId: OAT_ID, grams: 30 },
      { ingredientId: SALMON_OIL_ID, grams: 5 },
    ];
    const origTotal = items.reduce((s, i) => s + i.grams, 0);
    const sweetShare = 100 / origTotal;
    const oatShare = 30 / origTotal;
    const locked = new Set([SWEET_POTATO_ID, OAT_ID]);
    const r = solveRebalance(items, locked, { proteinPct: 45, fatPct: 25, carbPct: 25 });
    const newTotal = r.items.reduce((s, i) => s + i.grams, 0);
    const sweet = r.items.find(i => i.ingredientId === SWEET_POTATO_ID)!;
    const oat = r.items.find(i => i.ingredientId === OAT_ID)!;
    expect(Math.abs(sweet.grams / newTotal - sweetShare)).toBeLessThan(0.01);
    expect(Math.abs(oat.grams / newTotal - oatShare)).toBeLessThan(0.01);
  });

  it("returns Ca:P ratio in the result", () => {
    const items = [
      { ingredientId: CHICKEN_BREAST_ID, grams: 200 },
      { ingredientId: SWEET_POTATO_ID, grams: 100 },
    ];
    const r = solveRebalance(items, new Set(), { proteinPct: 40, fatPct: 30, carbPct: 30 });
    expect(r.caPRatio).not.toBeNull();
    expect(typeof r.caPRatio).toBe("number");
  });

  it("returns AAFCO summary when aafcoTarget option provided", () => {
    const items = [
      { ingredientId: CHICKEN_BREAST_ID, grams: 200 },
      { ingredientId: SWEET_POTATO_ID, grams: 100 },
      { ingredientId: SALMON_OIL_ID, grams: 5 },
    ];
    const r = solveRebalance(
      items,
      new Set(),
      { proteinPct: 40, fatPct: 30, carbPct: 30 },
      { aafcoTarget: { species: "dog", isGrowth: false } },
    );
    expect(r.aafco).toBeDefined();
    expect(r.aafco!.met + r.aafco!.below + r.aafco!.over).toBeGreaterThan(0);
  });

  it("returns all_locked when every ingredient is locked", () => {
    const items = [
      { ingredientId: CHICKEN_BREAST_ID, grams: 200 },
      { ingredientId: SALMON_ID, grams: 50 },
    ];
    const locked = new Set([CHICKEN_BREAST_ID, SALMON_ID]);
    const r = solveRebalance(items, locked, { proteinPct: 30, fatPct: 60, carbPct: 10 });
    expect(r.status).toBe("all_locked");
    expect(r.items[0].grams).toBe(200);
    expect(r.items[1].grams).toBe(50);
  });

  it("flags no_unlocked_macro_source when no ingredient can hit any target macro", () => {
    // Items have only carb sources but user asks for high P+F+C — protein and fat are unreachable.
    const items = [{ ingredientId: SWEET_POTATO_ID, grams: 100 }];
    // All-zero targets are technically all reachable, so we set non-zero P+F+C targets
    // with only a carb ingredient available. Protein/Fat sources are missing.
    const r = solveRebalance(items, new Set(), { proteinPct: 50, fatPct: 30, carbPct: 20 });
    // With only one carb-only ingredient, protein and fat can't be hit;
    // status should be partial or no_unlocked_macro_source.
    expect(["partial", "no_unlocked_macro_source", "infeasible"]).toContain(r.status);
  });

  it("does not mutate caller's items array", () => {
    const items = [
      { ingredientId: CHICKEN_BREAST_ID, grams: 200 },
      { ingredientId: SWEET_POTATO_ID, grams: 100 },
    ];
    const before = JSON.stringify(items);
    solveRebalance(items, new Set(), { proteinPct: 40, fatPct: 30, carbPct: 30 });
    expect(JSON.stringify(items)).toBe(before);
  });

  it("floor rule: ingredient already below 2% of recipe stays at its starting % share", () => {
    // Eggshell powder (id 79 in seed). Use chicken+sweet potato as macro carriers,
    // and add a tiny eggshell-like supplement as a sub-2% item.
    // Using oat (id 9) at very low grams to simulate a sub-2% supplement.
    const items = [
      { ingredientId: CHICKEN_BREAST_ID, grams: 400 },
      { ingredientId: SWEET_POTATO_ID, grams: 195 },
      { ingredientId: OAT_ID, grams: 5 }, // 5/600 = 0.83% of recipe (below 2%)
    ];
    const origTotal = items.reduce((s, i) => s + i.grams, 0);
    const oatStartPct = 5 / origTotal;
    const r = solveRebalance(items, new Set(), { proteinPct: 50, fatPct: 20, carbPct: 25 });
    const oat = r.items.find(i => i.ingredientId === OAT_ID)!;
    const newTotal = r.items.reduce((s, i) => s + i.grams, 0);
    const oatNewPct = oat.grams / newTotal;
    // Sub-2% items must NOT be allowed to drop below their starting %.
    expect(oatNewPct).toBeGreaterThanOrEqual(oatStartPct - 0.001);
  });

  it("auto-locks items ≤2% of original recipe (treats them as user-locked)", () => {
    // Total = 385 g; salmon oil at 5g = 1.3% ≤ 2% → should be auto-locked.
    const items = [
      { ingredientId: CHICKEN_BREAST_ID, grams: 200 },
      { ingredientId: SALMON_ID, grams: 50 },
      { ingredientId: SWEET_POTATO_ID, grams: 100 },
      { ingredientId: OAT_ID, grams: 30 },
      { ingredientId: SALMON_OIL_ID, grams: 5 }, // 1.3% — sub-2%, must be untouched
    ];
    const r = solveRebalance(items, new Set(), { proteinPct: 80, fatPct: 18, carbPct: 2 });
    const oil = r.items.find(i => i.ingredientId === SALMON_OIL_ID)!;
    // Sub-2% item should be preserved at its starting % of new total.
    const newTotal = r.items.reduce((s, i) => s + i.grams, 0);
    const newOilPct = oil.grams / newTotal;
    const startOilPct = 5 / 385;
    // Auto-locked items preserve their % share of recipe (lock-by-% semantics).
    expect(Math.abs(newOilPct - startOilPct)).toBeLessThan(0.005);
  });

  it("preserves the achieved macros that round-tripping through recipeMacros confirms", () => {
    const items = [
      { ingredientId: CHICKEN_BREAST_ID, grams: 200 },
      { ingredientId: SALMON_ID, grams: 50 },
      { ingredientId: SWEET_POTATO_ID, grams: 100 },
    ];
    const r = solveRebalance(items, new Set(), { proteinPct: 40, fatPct: 30, carbPct: 30 });
    const totals = recipeTotals(r.items);
    const macros = recipeMacros(r.items, totals);
    expect(Math.abs(macros.proteinPct_DM - r.achieved.proteinPct)).toBeLessThan(0.5);
    expect(Math.abs(macros.fatPct_DM - r.achieved.fatPct)).toBeLessThan(0.5);
    expect(Math.abs(macros.carbPct_DM - r.achieved.carbPct)).toBeLessThan(0.5);
  });
});
