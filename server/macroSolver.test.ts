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

  it("respects locked ingredients (their grams are unchanged)", () => {
    const items = [
      { ingredientId: CHICKEN_BREAST_ID, grams: 200 },
      { ingredientId: SALMON_ID, grams: 50 },
      { ingredientId: SWEET_POTATO_ID, grams: 100 },
    ];
    const locked = new Set([SWEET_POTATO_ID]);
    const targets = { proteinPct: 50, fatPct: 30, carbPct: 15 };
    const r = solveRebalance(items, locked, targets);
    const sweet = r.items.find(i => i.ingredientId === SWEET_POTATO_ID);
    expect(sweet).toBeDefined();
    expect(sweet!.grams).toBe(100); // unchanged
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
