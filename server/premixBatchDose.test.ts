import { describe, expect, it } from "vitest";
import { computePremixBatch, SACHET_GRAMS } from "../shared/premixBatchDose";

describe("computePremixBatch", () => {
  it("matches the cat example: 5kg cat, 1 sachet/day, 150g batch = 1 day, 5g premix", () => {
    const out = computePremixBatch({
      sachetsPerDay: 1,
      batchGrams: 150,
      dailyFeedGrams: 150,
    });
    expect(out.days).toBeCloseTo(1.0, 3);
    expect(out.premixGrams).toBeCloseTo(5.0, 3);
    expect(out.sachetsInBatch).toBeCloseTo(1.0, 3);
  });

  it("matches the dog example: 8kg dog, 2 sachets/day, 415g batch / 267g daily = 1.55 days, 15.5g premix", () => {
    const out = computePremixBatch({
      sachetsPerDay: 2,
      batchGrams: 415,
      dailyFeedGrams: 267,
    });
    expect(out.days).toBeCloseTo(415 / 267, 3);
    expect(out.premixGrams).toBeCloseTo(2 * 5 * (415 / 267), 3);
    // ~ 15.54g
    expect(out.sachetsInBatch).toBeCloseTo(out.premixGrams / SACHET_GRAMS, 5);
  });

  it("preserves per-day ratio across batch sizes", () => {
    // Two batches for the same pet at different sizes must produce the same
    // premix-to-batch fraction (i.e. the same per-kcal nutrient density).
    const smallBatch = 200;
    const largeBatch = 2000;
    const small = computePremixBatch({ sachetsPerDay: 2, batchGrams: smallBatch, dailyFeedGrams: 267 });
    const large = computePremixBatch({ sachetsPerDay: 2, batchGrams: largeBatch, dailyFeedGrams: 267 });
    expect(small.premixGrams / smallBatch).toBeCloseTo(large.premixGrams / largeBatch, 6);
  });

  it("warns 'batch-too-small' when days < 0.5", () => {
    const out = computePremixBatch({ sachetsPerDay: 1, batchGrams: 50, dailyFeedGrams: 200 });
    expect(out.warnings).toContain("batch-too-small");
  });

  it("warns 'batch-too-large' when days > 10", () => {
    const out = computePremixBatch({ sachetsPerDay: 1, batchGrams: 3000, dailyFeedGrams: 200 });
    expect(out.warnings).toContain("batch-too-large");
  });

  it("warns 'premix-too-heavy' when premix > 10% of batch", () => {
    // Tiny batch where premix is dominant.
    const out = computePremixBatch({ sachetsPerDay: 4, batchGrams: 100, dailyFeedGrams: 100 });
    // 4 sachets × 5g × 1 day = 20g premix in 100g batch = 20%
    expect(out.warnings).toContain("premix-too-heavy");
  });

  it("returns zero with no-fresh-food warning for invalid daily feed", () => {
    const out = computePremixBatch({ sachetsPerDay: 1, batchGrams: 200, dailyFeedGrams: 0 });
    expect(out.premixGrams).toBe(0);
    expect(out.warnings).toContain("no-fresh-food");
  });

  it("returns zero with no-fresh-food warning for invalid sachets", () => {
    const out = computePremixBatch({ sachetsPerDay: 0, batchGrams: 200, dailyFeedGrams: 200 });
    expect(out.premixGrams).toBe(0);
    expect(out.warnings).toContain("no-fresh-food");
  });

  it("scales linearly with sachetsPerDay (twice the dose, twice the premix)", () => {
    const a = computePremixBatch({ sachetsPerDay: 1, batchGrams: 500, dailyFeedGrams: 250 });
    const b = computePremixBatch({ sachetsPerDay: 2, batchGrams: 500, dailyFeedGrams: 250 });
    expect(b.premixGrams).toBeCloseTo(a.premixGrams * 2, 5);
  });
});
