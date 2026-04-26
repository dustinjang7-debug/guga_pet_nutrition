// AAFCO Dog & Cat Food Nutrient Profiles
// Source: AAFCO Official Publication (Dog Food Nutrient Profiles based on the 2016 revision;
// Cat Food Nutrient Profiles based on the 2014 revision). Values are widely reproduced in
// Hand et al. "Small Animal Clinical Nutrition" 5th ed., NRC 2006, and the AAFCO website
// (https://www.aafco.org). Units are presented on a Dry Matter (DM) basis as published.
// "Per 1000 kcal ME" values are derived in code by dividing the DM amount by the
// recipe's energy density (kcal/kg DM) — see calc.ts.

export type LifeStage = "adult" | "growth";
export type Species = "dog" | "cat";

export interface NutrientSpec {
  /** Stable key used across ingredients & AAFCO tables */
  key: string;
  /** Human label */
  label: string;
  /** Display unit on a per-kg DM basis */
  unit: string;
  /** Group for table sectioning */
  group:
    | "Proximate"
    | "Amino Acid"
    | "Fatty Acid"
    | "Mineral"
    | "Vitamin";
  /** AAFCO minimum on a Dry Matter basis (per kg DM) — null if not specified */
  min: number | null;
  /** AAFCO maximum on a Dry Matter basis (per kg DM) — null if not specified */
  max: number | null;
}

export interface AafcoProfile {
  species: Species;
  stage: LifeStage;
  /** Profile name as published */
  name: string;
  nutrients: NutrientSpec[];
}

// ---------------------------------------------------------------------------
// DOG — Adult Maintenance (AAFCO 2016)
// All values per kg of diet on a Dry Matter basis unless noted otherwise.
// ---------------------------------------------------------------------------
const DOG_ADULT: NutrientSpec[] = [
  // Proximates
  { key: "crude_protein", label: "Crude Protein", unit: "g/kg", group: "Proximate", min: 180, max: null },
  { key: "crude_fat", label: "Crude Fat", unit: "g/kg", group: "Proximate", min: 55, max: null },

  // Amino acids (g/kg DM)
  { key: "arginine", label: "Arginine", unit: "g/kg", group: "Amino Acid", min: 5.1, max: null },
  { key: "histidine", label: "Histidine", unit: "g/kg", group: "Amino Acid", min: 1.9, max: null },
  { key: "isoleucine", label: "Isoleucine", unit: "g/kg", group: "Amino Acid", min: 3.8, max: null },
  { key: "leucine", label: "Leucine", unit: "g/kg", group: "Amino Acid", min: 6.8, max: null },
  { key: "lysine", label: "Lysine", unit: "g/kg", group: "Amino Acid", min: 5.1, max: null },
  { key: "methionine", label: "Methionine", unit: "g/kg", group: "Amino Acid", min: 3.3, max: null },
  { key: "methionine_cystine", label: "Methionine + Cystine", unit: "g/kg", group: "Amino Acid", min: 6.5, max: null },
  { key: "phenylalanine", label: "Phenylalanine", unit: "g/kg", group: "Amino Acid", min: 4.5, max: null },
  { key: "phenylalanine_tyrosine", label: "Phenylalanine + Tyrosine", unit: "g/kg", group: "Amino Acid", min: 7.4, max: null },
  { key: "threonine", label: "Threonine", unit: "g/kg", group: "Amino Acid", min: 4.3, max: null },
  { key: "tryptophan", label: "Tryptophan", unit: "g/kg", group: "Amino Acid", min: 1.4, max: null },
  { key: "valine", label: "Valine", unit: "g/kg", group: "Amino Acid", min: 4.9, max: null },

  // Fatty acids
  { key: "linoleic_acid", label: "Linoleic Acid (n-6)", unit: "g/kg", group: "Fatty Acid", min: 11, max: null },

  // Minerals (g/kg or mg/kg DM as specified)
  { key: "calcium", label: "Calcium", unit: "g/kg", group: "Mineral", min: 5.0, max: 25 },
  { key: "phosphorus", label: "Phosphorus", unit: "g/kg", group: "Mineral", min: 4.0, max: 16 },
  { key: "ca_p_ratio", label: "Ca:P Ratio", unit: "ratio", group: "Mineral", min: 1.0, max: 2.0 },
  { key: "potassium", label: "Potassium", unit: "g/kg", group: "Mineral", min: 6.0, max: null },
  { key: "sodium", label: "Sodium", unit: "g/kg", group: "Mineral", min: 0.8, max: null },
  { key: "chloride", label: "Chloride", unit: "g/kg", group: "Mineral", min: 1.2, max: null },
  { key: "magnesium", label: "Magnesium", unit: "g/kg", group: "Mineral", min: 0.6, max: null },
  { key: "iron", label: "Iron", unit: "mg/kg", group: "Mineral", min: 40, max: null },
  { key: "copper", label: "Copper", unit: "mg/kg", group: "Mineral", min: 7.3, max: null },
  { key: "manganese", label: "Manganese", unit: "mg/kg", group: "Mineral", min: 5.0, max: null },
  { key: "zinc", label: "Zinc", unit: "mg/kg", group: "Mineral", min: 80, max: null },
  { key: "iodine", label: "Iodine", unit: "mg/kg", group: "Mineral", min: 1.0, max: 11 },
  { key: "selenium", label: "Selenium", unit: "mg/kg", group: "Mineral", min: 0.08, max: 2.0 },

  // Vitamins
  { key: "vit_a", label: "Vitamin A", unit: "IU/kg", group: "Vitamin", min: 5000, max: 250000 },
  { key: "vit_d", label: "Vitamin D", unit: "IU/kg", group: "Vitamin", min: 500, max: 5000 },
  { key: "vit_e", label: "Vitamin E", unit: "IU/kg", group: "Vitamin", min: 50, max: null },
  { key: "thiamin", label: "Thiamin (B1)", unit: "mg/kg", group: "Vitamin", min: 2.25, max: null },
  { key: "riboflavin", label: "Riboflavin (B2)", unit: "mg/kg", group: "Vitamin", min: 5.2, max: null },
  { key: "pantothenic_acid", label: "Pantothenic Acid (B5)", unit: "mg/kg", group: "Vitamin", min: 12, max: null },
  { key: "niacin", label: "Niacin (B3)", unit: "mg/kg", group: "Vitamin", min: 13.6, max: null },
  { key: "pyridoxine", label: "Pyridoxine (B6)", unit: "mg/kg", group: "Vitamin", min: 1.5, max: null },
  { key: "folic_acid", label: "Folic Acid", unit: "mg/kg", group: "Vitamin", min: 0.216, max: null },
  { key: "vit_b12", label: "Vitamin B12", unit: "mg/kg", group: "Vitamin", min: 0.028, max: null },
  { key: "choline", label: "Choline", unit: "mg/kg", group: "Vitamin", min: 1360, max: null },
];

// DOG — Growth & Reproduction (puppy + gestation/lactation) — AAFCO 2016
// Differences vs adult: higher protein, fat, AAs; tighter Ca/P; adds EPA+DHA.
const DOG_GROWTH: NutrientSpec[] = DOG_ADULT.map((n) => ({ ...n }));
function patch(base: NutrientSpec[], patches: Record<string, Partial<NutrientSpec>>) {
  return base.map((n) =>
    patches[n.key] ? { ...n, ...patches[n.key] } : n,
  );
}
const DOG_GROWTH_PATCHED = patch(DOG_GROWTH, {
  crude_protein: { min: 225 },
  crude_fat: { min: 85 },
  arginine: { min: 10.0 },
  histidine: { min: 4.4 },
  isoleucine: { min: 7.1 },
  leucine: { min: 12.9 },
  lysine: { min: 9.0 },
  methionine: { min: 3.5 },
  methionine_cystine: { min: 7.0 },
  phenylalanine: { min: 8.3 },
  phenylalanine_tyrosine: { min: 13.0 },
  threonine: { min: 10.4 },
  tryptophan: { min: 2.0 },
  valine: { min: 6.8 },
  calcium: { min: 12.0, max: 18.0 },
  phosphorus: { min: 10.0, max: 16.0 },
  sodium: { min: 3.0 },
  chloride: { min: 4.5 },
});
// Add EPA+DHA requirement for growth/repro
DOG_GROWTH_PATCHED.push({
  key: "epa_dha",
  label: "EPA + DHA",
  unit: "g/kg",
  group: "Fatty Acid",
  min: 0.5,
  max: null,
});
// Add alpha-linolenic acid for growth
DOG_GROWTH_PATCHED.push({
  key: "alpha_linolenic",
  label: "α-Linolenic Acid (n-3)",
  unit: "g/kg",
  group: "Fatty Acid",
  min: 0.8,
  max: null,
});

// ---------------------------------------------------------------------------
// CAT — Adult Maintenance (AAFCO 2014)
// ---------------------------------------------------------------------------
const CAT_ADULT: NutrientSpec[] = [
  { key: "crude_protein", label: "Crude Protein", unit: "g/kg", group: "Proximate", min: 260, max: null },
  { key: "crude_fat", label: "Crude Fat", unit: "g/kg", group: "Proximate", min: 90, max: null },

  { key: "arginine", label: "Arginine", unit: "g/kg", group: "Amino Acid", min: 10.4, max: null },
  { key: "histidine", label: "Histidine", unit: "g/kg", group: "Amino Acid", min: 2.6, max: null },
  { key: "isoleucine", label: "Isoleucine", unit: "g/kg", group: "Amino Acid", min: 5.2, max: null },
  { key: "leucine", label: "Leucine", unit: "g/kg", group: "Amino Acid", min: 12.5, max: null },
  { key: "lysine", label: "Lysine", unit: "g/kg", group: "Amino Acid", min: 8.3, max: null },
  { key: "methionine", label: "Methionine", unit: "g/kg", group: "Amino Acid", min: 2.0, max: 15 },
  { key: "methionine_cystine", label: "Methionine + Cystine", unit: "g/kg", group: "Amino Acid", min: 4.0, max: null },
  { key: "phenylalanine", label: "Phenylalanine", unit: "g/kg", group: "Amino Acid", min: 4.2, max: null },
  { key: "phenylalanine_tyrosine", label: "Phenylalanine + Tyrosine", unit: "g/kg", group: "Amino Acid", min: 16.9, max: null },
  { key: "threonine", label: "Threonine", unit: "g/kg", group: "Amino Acid", min: 7.3, max: null },
  { key: "tryptophan", label: "Tryptophan", unit: "g/kg", group: "Amino Acid", min: 1.6, max: null },
  { key: "valine", label: "Valine", unit: "g/kg", group: "Amino Acid", min: 6.2, max: null },
  { key: "taurine_extruded", label: "Taurine (extruded)", unit: "g/kg", group: "Amino Acid", min: 1.0, max: null },
  { key: "taurine_canned", label: "Taurine (canned/raw)", unit: "g/kg", group: "Amino Acid", min: 2.0, max: null },

  { key: "linoleic_acid", label: "Linoleic Acid (n-6)", unit: "g/kg", group: "Fatty Acid", min: 5.5, max: null },
  { key: "arachidonic_acid", label: "Arachidonic Acid", unit: "g/kg", group: "Fatty Acid", min: 0.06, max: null },

  { key: "calcium", label: "Calcium", unit: "g/kg", group: "Mineral", min: 6.0, max: null },
  { key: "phosphorus", label: "Phosphorus", unit: "g/kg", group: "Mineral", min: 5.0, max: null },
  { key: "ca_p_ratio", label: "Ca:P Ratio", unit: "ratio", group: "Mineral", min: 1.0, max: 1.5 },
  { key: "potassium", label: "Potassium", unit: "g/kg", group: "Mineral", min: 6.0, max: null },
  { key: "sodium", label: "Sodium", unit: "g/kg", group: "Mineral", min: 0.6, max: null },
  { key: "chloride", label: "Chloride", unit: "g/kg", group: "Mineral", min: 0.9, max: null },
  { key: "magnesium", label: "Magnesium", unit: "g/kg", group: "Mineral", min: 0.4, max: null },
  { key: "iron", label: "Iron", unit: "mg/kg", group: "Mineral", min: 80, max: null },
  { key: "copper", label: "Copper", unit: "mg/kg", group: "Mineral", min: 5.0, max: null },
  { key: "manganese", label: "Manganese", unit: "mg/kg", group: "Mineral", min: 7.6, max: null },
  { key: "zinc", label: "Zinc", unit: "mg/kg", group: "Mineral", min: 75, max: null },
  { key: "iodine", label: "Iodine", unit: "mg/kg", group: "Mineral", min: 0.6, max: 9 },
  { key: "selenium", label: "Selenium", unit: "mg/kg", group: "Mineral", min: 0.3, max: null },

  { key: "vit_a", label: "Vitamin A", unit: "IU/kg", group: "Vitamin", min: 3332, max: 333300 },
  { key: "vit_d", label: "Vitamin D", unit: "IU/kg", group: "Vitamin", min: 280, max: 30080 },
  { key: "vit_e", label: "Vitamin E", unit: "IU/kg", group: "Vitamin", min: 40, max: null },
  { key: "vit_k", label: "Vitamin K", unit: "mg/kg", group: "Vitamin", min: 0.1, max: null },
  { key: "thiamin", label: "Thiamin (B1)", unit: "mg/kg", group: "Vitamin", min: 5.6, max: null },
  { key: "riboflavin", label: "Riboflavin (B2)", unit: "mg/kg", group: "Vitamin", min: 4.0, max: null },
  { key: "pantothenic_acid", label: "Pantothenic Acid (B5)", unit: "mg/kg", group: "Vitamin", min: 5.75, max: null },
  { key: "niacin", label: "Niacin (B3)", unit: "mg/kg", group: "Vitamin", min: 60, max: null },
  { key: "pyridoxine", label: "Pyridoxine (B6)", unit: "mg/kg", group: "Vitamin", min: 4.0, max: null },
  { key: "folic_acid", label: "Folic Acid", unit: "mg/kg", group: "Vitamin", min: 0.8, max: null },
  { key: "biotin", label: "Biotin", unit: "mg/kg", group: "Vitamin", min: 0.07, max: null },
  { key: "vit_b12", label: "Vitamin B12", unit: "mg/kg", group: "Vitamin", min: 0.02, max: null },
  { key: "choline", label: "Choline", unit: "mg/kg", group: "Vitamin", min: 2400, max: null },
];

// CAT — Growth & Reproduction (AAFCO 2014)
const CAT_GROWTH = patch(CAT_ADULT.map((n) => ({ ...n })), {
  crude_protein: { min: 300 },
  arginine: { min: 12.4 },
  histidine: { min: 3.3 },
  isoleucine: { min: 5.6 },
  leucine: { min: 12.8 },
  lysine: { min: 12.0 },
  methionine: { min: 4.4 },
  methionine_cystine: { min: 8.8 },
  phenylalanine: { min: 5.2 },
  phenylalanine_tyrosine: { min: 19.1 },
  threonine: { min: 7.3 },
  tryptophan: { min: 2.5 },
  valine: { min: 6.4 },
  arachidonic_acid: { min: 0.2 },
  calcium: { min: 10.0 },
  phosphorus: { min: 8.0 },
  magnesium: { min: 0.8 },
  iron: { min: 80 },
  copper: { min: 8.4 },
  vit_a: { min: 6668 },
  vit_d: { min: 280 },
  niacin: { min: 60 },
});
// add EPA+DHA for kittens
CAT_GROWTH.push({
  key: "epa_dha",
  label: "EPA + DHA",
  unit: "g/kg",
  group: "Fatty Acid",
  min: 0.2,
  max: null,
});

export const AAFCO_PROFILES: AafcoProfile[] = [
  { species: "dog", stage: "adult", name: "AAFCO Dog — Adult Maintenance (2016)", nutrients: DOG_ADULT },
  { species: "dog", stage: "growth", name: "AAFCO Dog — Growth & Reproduction (2016)", nutrients: DOG_GROWTH_PATCHED },
  { species: "cat", stage: "adult", name: "AAFCO Cat — Adult Maintenance (2014)", nutrients: CAT_ADULT },
  { species: "cat", stage: "growth", name: "AAFCO Cat — Growth & Reproduction (2014)", nutrients: CAT_GROWTH },
];

export function getProfile(species: Species, stage: LifeStage): AafcoProfile {
  const p = AAFCO_PROFILES.find((p) => p.species === species && p.stage === stage);
  if (!p) throw new Error(`No AAFCO profile for ${species}/${stage}`);
  return p;
}

/** Master nutrient list ordered for display (union of dog + cat). */
export const NUTRIENT_ORDER: { key: string; label: string; unit: string; group: NutrientSpec["group"] }[] = (() => {
  const seen = new Map<string, { key: string; label: string; unit: string; group: NutrientSpec["group"] }>();
  for (const profile of AAFCO_PROFILES) {
    for (const n of profile.nutrients) {
      if (!seen.has(n.key)) seen.set(n.key, { key: n.key, label: n.label, unit: n.unit, group: n.group });
    }
  }
  const order: NutrientSpec["group"][] = ["Proximate", "Amino Acid", "Fatty Acid", "Mineral", "Vitamin"];
  return Array.from(seen.values()).sort(
    (a, b) => order.indexOf(a.group) - order.indexOf(b.group),
  );
})();
