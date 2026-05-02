import { describe, expect, it } from "vitest";
import { rebalanceByPct, totalGrams, gramsToPct } from "@shared/rebalance";

describe("rebalanceByPct", () => {
  it("preserves total grams when raising one row's %", () => {
    const items = [
      { ingredientId: 1, grams: 500 },
      { ingredientId: 2, grams: 300 },
      { ingredientId: 3, grams: 200 },
    ];
    const next = rebalanceByPct(items, 1, 60);
    expect(totalGrams(next)).toBeCloseTo(1000, 1);
    expect(next.find(i => i.ingredientId === 1)!.grams).toBeCloseTo(600, 1);
  });

  it("distributes the delta pro-rata across unlocked rows", () => {
    const items = [
      { ingredientId: 1, grams: 500 },
      { ingredientId: 2, grams: 300 },
      { ingredientId: 3, grams: 200 },
    ];
    // Raise row 1 from 50% to 60% → take 100g from rows 2+3, weighted 300:200
    const next = rebalanceByPct(items, 1, 60);
    expect(next.find(i => i.ingredientId === 2)!.grams).toBeCloseTo(240, 1); // 300 - 60
    expect(next.find(i => i.ingredientId === 3)!.grams).toBeCloseTo(160, 1); // 200 - 40
  });

  it("respects locked rows — they keep absolute grams", () => {
    const items = [
      { ingredientId: 1, grams: 500 },
      { ingredientId: 2, grams: 300, locked: true },
      { ingredientId: 3, grams: 200 },
    ];
    const next = rebalanceByPct(items, 1, 60);
    expect(next.find(i => i.ingredientId === 2)!.grams).toBeCloseTo(300, 1);
    expect(next.find(i => i.ingredientId === 1)!.grams).toBeCloseTo(600, 1);
    expect(next.find(i => i.ingredientId === 3)!.grams).toBeCloseTo(100, 1);
    expect(totalGrams(next)).toBeCloseTo(1000, 1);
  });

  it("clamps the edited % when locked rows take all available slack", () => {
    const items = [
      { ingredientId: 1, grams: 500 },
      { ingredientId: 2, grams: 400, locked: true },
      { ingredientId: 3, grams: 100, locked: true },
    ];
    // Slack = 1000 - 500(locked) = 500. Edited cannot exceed 500g (50%).
    const next = rebalanceByPct(items, 1, 90);
    expect(next.find(i => i.ingredientId === 1)!.grams).toBeCloseTo(500, 1);
    expect(totalGrams(next)).toBeCloseTo(1000, 1);
  });

  it("falls back to equal split when unlocked rows have zero grams", () => {
    const items = [
      { ingredientId: 1, grams: 800 },
      { ingredientId: 2, grams: 0 },
      { ingredientId: 3, grams: 0 },
    ];
    // Lower row 1 from 100% to 50% (= 400g). 400g must go to rows 2+3 equally.
    const items2 = [
      { ingredientId: 1, grams: 1000 },
      { ingredientId: 2, grams: 0 },
      { ingredientId: 3, grams: 0 },
    ];
    const next = rebalanceByPct(items2, 1, 50);
    expect(next.find(i => i.ingredientId === 1)!.grams).toBeCloseTo(500, 1);
    expect(next.find(i => i.ingredientId === 2)!.grams).toBeCloseTo(250, 1);
    expect(next.find(i => i.ingredientId === 3)!.grams).toBeCloseTo(250, 1);
  });

  it("treats negative pct as 0", () => {
    const items = [
      { ingredientId: 1, grams: 200 },
      { ingredientId: 2, grams: 800 },
    ];
    const next = rebalanceByPct(items, 1, -5);
    expect(next.find(i => i.ingredientId === 1)!.grams).toBeCloseTo(0, 1);
    expect(next.find(i => i.ingredientId === 2)!.grams).toBeCloseTo(1000, 1);
  });

  it("returns the input unchanged when total is zero", () => {
    const items = [
      { ingredientId: 1, grams: 0 },
      { ingredientId: 2, grams: 0 },
    ];
    const next = rebalanceByPct(items, 1, 50);
    expect(next).toEqual(items);
  });

  it("gramsToPct returns 0 when total is 0", () => {
    expect(gramsToPct(50, 0)).toBe(0);
    expect(gramsToPct(50, 200)).toBe(25);
  });
});
