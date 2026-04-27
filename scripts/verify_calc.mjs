// Manual hand-calc verification for Ca / P / Na / B12 / Fe / Zn after the v0.2.6 unit fix.
// Builds two realistic wizard outputs and compares the computeAafco output
// against an independent hand calculation done from the raw ingredient JSON.

import { readFileSync } from "node:fs";
import { recipeTotals, recipeMacros, aafcoComparison } from "../shared/calc.ts";

const ING = JSON.parse(
  readFileSync(new URL("../shared/ingredients.ts", import.meta.url), "utf8")
    .replace(/^[\s\S]*?export const INGREDIENTS[^=]*=\s*/, "")
    .replace(/;\s*[\s\S]*$/, "")
);
const BY_ID = Object.fromEntries(ING.map((i) => [i.id, i]));

function handCalc(items, key) {
  let total = 0;
  let dm_g = 0;
  for (const it of items) {
    const ing = BY_ID[it.ingredientId];
    if (!ing) throw new Error("missing " + it.ingredientId);
    total += (ing[key] ?? 0) * (it.grams / 100);
    dm_g += (100 - (ing.water_g ?? 0)) * (it.grams / 100);
  }
  return { total, dm_g, perKgDM: dm_g > 0 ? total / (dm_g / 1000) : 0 };
}

function row(items, key) {
  const totals = recipeTotals(items);
  const macros = recipeMacros(items, totals);
  const rows = aafcoComparison(totals, macros, "dog", false);
  return rows.find((r) => r.nutrient.key === key);
}

function compare(label, items, keys) {
  console.log("\n=== " + label + " ===");
  const totals = recipeTotals(items);
  const macros = recipeMacros(items, totals);
  console.log(
    `Recipe weight ${items.reduce((s, i) => s + i.grams, 0)} g · DM ${macros.totalDryMatter_g.toFixed(1)} g · ${macros.totalKcal.toFixed(0)} kcal`
  );
  for (const key of keys) {
    const hc = handCalc(items, key);
    const r = row(items, key);
    const min = r?.min ?? null;
    const max = r?.max ?? null;
    const ok =
      Math.abs(r.perKgDM - hc.perKgDM) < 0.5 &&
      Math.abs(r.totalInRecipe - hc.total) < 0.01;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${key.padEnd(15)}  total ${hc.total.toFixed(2).padStart(10)}  perKgDM hc=${hc.perKgDM.toFixed(2).padStart(10)} app=${r.perKgDM.toFixed(2).padStart(10)}  min ${min} max ${max}  status ${r.status}`
    );
  }
}

// Recipe A: 6g eggshell + 400g chicken breast (the user's bug report scenario)
compare(
  "A — 400g chicken breast + 6g eggshell powder",
  [
    { ingredientId: 65, grams: 400 },
    { ingredientId: 159, grams: 6 },
  ],
  [
    "calcium_mg",
    "phosphorus_mg",
    "sodium_mg",
    "vit_b12_ug",
    "iron_mg",
    "zinc_mg",
  ]
);

// Recipe B: a full wizard-shaped recipe (the screenshot one)
compare(
  "B — Full wizard recipe (8 ingredients)",
  [
    { ingredientId: 65, grams: 400 }, // chicken breast
    { ingredientId: 159, grams: 6 }, // eggshell powder
  ].concat(
    [
      ["Rice, white", 80],
      ["Sweet potato, red flesh", 60],
      ["Chicken liver", 70],
      ["Egg yolk", 30],
      ["Sunflower oil", 17],
      ["Raw oyster", 30],
    ].map(([name, grams]) => {
      const found = ING.find((i) => i.name_en === name);
      if (!found) throw new Error("missing ingredient " + name);
      return { ingredientId: found.id, grams };
    })
  ),
  [
    "calcium_mg",
    "phosphorus_mg",
    "sodium_mg",
    "vit_b12_ug",
    "iron_mg",
    "zinc_mg",
    "protein_g",
    "fat_g",
  ]
);
