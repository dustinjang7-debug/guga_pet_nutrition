import { describe, it, expect } from "vitest";
import {
  recipeTotals,
  recipeMacros,
  aafcoComparison,
  type AafcoRow,
} from "../shared/calc";
import { INGREDIENT_BY_ID, INGREDIENTS } from "../shared/ingredients";

type Item = { ingredientId: number; grams: number };

function handCalc(items: Item[], key: keyof (typeof INGREDIENTS)[number]) {
  let total = 0;
  let dm_g = 0;
  for (const it of items) {
    const ing = INGREDIENT_BY_ID[it.ingredientId];
    if (!ing) throw new Error("missing " + it.ingredientId);
    const v = (ing as unknown as Record<string, number>)[key as string] ?? 0;
    total += v * (it.grams / 100);
    dm_g += (100 - (ing.water_g ?? 0)) * (it.grams / 100);
  }
  return { total, dm_g, perKgDM: dm_g > 0 ? total / (dm_g / 1000) : 0 };
}

function row(items: Item[], key: string): AafcoRow {
  const totals = recipeTotals(items);
  const macros = recipeMacros(items, totals);
  const rows = aafcoComparison(totals, macros, "dog", false);
  const r = rows.find((x) => x.nutrient.key === key);
  if (!r) throw new Error("missing nutrient row " + key);
  return r;
}

const eggshell = INGREDIENTS.find((i) => i.name_en === "Eggshell powder");
const chicken = INGREDIENTS.find((i) => i.name_en === "Chicken breast");
const liver = INGREDIENTS.find((i) => i.name_en === "Chicken liver");
const eggYolk = INGREDIENTS.find((i) => i.name_en === "Egg yolk");
const sunflower = INGREDIENTS.find((i) => i.name_en === "Sunflower oil");
const oyster = INGREDIENTS.find((i) => i.name_en === "Raw oyster");
const sweet = INGREDIENTS.find((i) => i.name_en === "Sweet potato, red flesh");
const rice = INGREDIENTS.find((i) => i.name_en === "Rice, white");

describe("Hand-calc audit (post v0.2.6 unit fix)", () => {
  it("Recipe A — 400g chicken breast + 6g eggshell powder", () => {
    expect(eggshell, "DB missing Eggshell powder").toBeTruthy();
    expect(chicken, "DB missing Chicken breast").toBeTruthy();
    if (!eggshell || !chicken) return;
    const items: Item[] = [
      { ingredientId: chicken.id, grams: 400 },
      { ingredientId: eggshell.id, grams: 6 },
    ];
    for (const key of ["calcium_mg", "phosphorus_mg", "sodium_mg", "vit_b12_ug", "iron_mg", "zinc_mg"] as const) {
      const hc = handCalc(items, key);
      const r = row(items, key);
      expect(r.totalInRecipe, `total mismatch on ${key}`).toBeCloseTo(hc.total, 2);
      expect(r.perKgDM, `perKgDM mismatch on ${key}`).toBeCloseTo(hc.perKgDM, 1);
    }
    // Specific to user's bug report: Ca should NOT be Below
    const ca = row(items, "calcium_mg");
    expect(ca.perKgDM).toBeGreaterThan(5000); // dog adult min
    expect(ca.status).not.toBe("below");
  });

  it("Recipe B — full screenshot recipe (8 ingredients)", () => {
    if (!eggshell || !chicken || !liver || !eggYolk || !sunflower || !oyster || !sweet || !rice) return;
    const items: Item[] = [
      { ingredientId: chicken.id, grams: 400 },
      { ingredientId: rice.id, grams: 80 },
      { ingredientId: sweet.id, grams: 60 },
      { ingredientId: liver.id, grams: 70 },
      { ingredientId: eggYolk.id, grams: 30 },
      { ingredientId: sunflower.id, grams: 17 },
      { ingredientId: oyster.id, grams: 30 },
      { ingredientId: eggshell.id, grams: 6 },
    ];
    for (const key of ["calcium_mg", "phosphorus_mg", "sodium_mg", "vit_b12_ug", "iron_mg", "zinc_mg", "protein_g", "fat_g"] as const) {
      const hc = handCalc(items, key);
      const r = row(items, key);
      expect(r.totalInRecipe, `total mismatch on ${key}`).toBeCloseTo(hc.total, 2);
      expect(r.perKgDM, `perKgDM mismatch on ${key}`).toBeCloseTo(hc.perKgDM, 1);
    }
    // Sanity: math sanity only — in the GUGA DB, several B12-rich ingredients
    // (chicken liver, oyster) have B12 stored at very low values (e.g. 0.02 μg/100g)
    // due to source-data rounding. Per product decision, the DB is the source of
    // truth; recipes that fall short of B12 are expected to add brewer's yeast or
    // a B-complex supplement. Here we only assert that B12 is computed (>= 0).
    const b12 = row(items, "vit_b12_ug");
    expect(b12.perKgDM).toBeGreaterThanOrEqual(0);
    // Phosphorus from chicken + liver + oyster + eggshell should be above min (4000 mg/kg DM)
    const p = row(items, "phosphorus_mg");
    expect(p.perKgDM).toBeGreaterThan(4000);
    // Sodium with no salt added should be tested: just assert math, not status
  });

  it("Iron min for adult dog = 40 mg/kg DM (sanity check on threshold storage)", () => {
    const items: Item[] = [{ ingredientId: chicken!.id, grams: 100 }];
    const r = row(items, "iron_mg");
    expect(r.min).toBe(40);
    expect(r.nutrient.unit).toBe("mg/kg DM");
  });

  it("Calcium AAFCO row reports unit mg/kg DM (post fix)", () => {
    const items: Item[] = [{ ingredientId: chicken!.id, grams: 100 }];
    const r = row(items, "calcium_mg");
    expect(r.nutrient.unit).toBe("mg/kg DM");
    expect(r.min).toBe(5000);
    expect(r.max).toBe(25000);
  });
});
