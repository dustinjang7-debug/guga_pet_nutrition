import { describe, it, expect } from "vitest";
import {
  recipeTotals,
  recipeMacros,
  aafcoComparison,
} from "../shared/calc";
import { INGREDIENT_BY_ID, INGREDIENTS } from "../shared/ingredients";

type Item = { ingredientId: number; grams: number };

function find(name: string) {
  const i = INGREDIENTS.find((x) => x.name_en === name);
  if (!i) throw new Error("missing " + name);
  return i;
}

const items: Item[] = [
  { ingredientId: find("Chicken breast").id, grams: 400 },
  { ingredientId: find("Rice, white").id, grams: 50 },
  { ingredientId: find("Sweet potato, red flesh").id, grams: 60 },
  { ingredientId: find("Chicken liver").id, grams: 70 },
  { ingredientId: find("Egg yolk").id, grams: 30 },
  { ingredientId: find("Sunflower oil").id, grams: 15 },
  { ingredientId: find("Raw oyster").id, grams: 30 },
  { ingredientId: find("Eggshell powder").id, grams: 6 },
];

function handCalc(key: string) {
  let total = 0;
  let dm_g = 0;
  for (const it of items) {
    const ing = INGREDIENT_BY_ID[it.ingredientId] as unknown as Record<
      string,
      number
    >;
    total += (ing[key] ?? 0) * (it.grams / 100);
    dm_g += (100 - (ing.water_g ?? 0)) * (it.grams / 100);
  }
  return { total, dm_g, perKgDM: dm_g > 0 ? total / (dm_g / 1000) : 0 };
}

describe("FULL audit of user's 8-ingredient recipe (50g rice variant)", () => {
  const totals = recipeTotals(items);
  const macros = recipeMacros(items, totals);
  const rows = aafcoComparison(totals, macros, "dog", false);

  it("prints recipe + status table", () => {
    const totalWeight = items.reduce((s, i) => s + i.grams, 0);
    const summary: string[] = [];
    summary.push("");
    summary.push("=".repeat(95));
    summary.push(
      `RECIPE: ${totalWeight} g fresh weight | DM ${macros.totalDryMatter_g.toFixed(1)} g | ${macros.totalKcal.toFixed(0)} kcal`
    );
    summary.push("=".repeat(95));
    summary.push("");
    summary.push(
      `${"Nutrient".padEnd(20)}${"Total".padStart(12)}${"per kg DM (app)".padStart(20)}${"per kg DM (hand)".padStart(20)}${"min".padStart(10)}${"max".padStart(10)}  Status`
    );
    summary.push("-".repeat(95));
    for (const r of rows) {
      const hc = handCalc(r.nutrient.key);
      const match = Math.abs(r.perKgDM - hc.perKgDM) < 0.5 ? "✓" : "✗";
      summary.push(
        `${r.nutrient.label_en.padEnd(20)}${r.totalInRecipe.toFixed(2).padStart(12)}${r.perKgDM.toFixed(2).padStart(20)}${hc.perKgDM.toFixed(2).padStart(20)}${String(r.min ?? "-").padStart(10)}${String(r.max ?? "-").padStart(10)}  ${r.status} ${match}`
      );
    }
    summary.push("");
    summary.push(
      `Pass: ${rows.filter((r) => r.status === "within").length}  Below: ${rows.filter((r) => r.status === "below").length}  Above: ${rows.filter((r) => r.status === "above").length}`
    );
    summary.push("");
    summary.push("--- B12 forensic ---");
    summary.push(
      `Chicken liver DB B12  : ${INGREDIENT_BY_ID[find("Chicken liver").id].vit_b12_ug} μg/100g  (USDA: 16.6)`
    );
    summary.push(
      `Raw oyster   DB B12   : ${INGREDIENT_BY_ID[find("Raw oyster").id].vit_b12_ug} μg/100g  (USDA: 16.0)`
    );
    summary.push(
      `Egg yolk     DB B12   : ${INGREDIENT_BY_ID[find("Egg yolk").id].vit_b12_ug} μg/100g  (USDA: 1.95)`
    );
    summary.push(`If DB used USDA values:`);
    const usda_b12 =
      (16.6 * 70 + 16.0 * 30 + 1.95 * 30) / 100; // μg
    summary.push(
      `  total B12 would be ${usda_b12.toFixed(2)} μg → ${(usda_b12 / (macros.totalDryMatter_g / 1000)).toFixed(2)} μg/kg DM (need 28)`
    );
    console.log(summary.join("\n"));
    // Just assert the math is internally consistent — that's the point.
    for (const r of rows) {
      const hc = handCalc(r.nutrient.key);
      expect(
        Math.abs(r.perKgDM - hc.perKgDM),
        `perKgDM mismatch on ${r.nutrient.key}`
      ).toBeLessThan(0.5);
    }
  });
});
