/**
 * GUGA Pet Nutrition — AAFCO Reference Standards
 *
 * Sources:
 * - AAFCO Official Publication 2016 — Dog Food Nutrient Profiles
 * - AAFCO Official Publication 2016 — Cat Food Nutrient Profiles
 * - User-supplied Chinese reference tool (1.x dog, 2.0 cat) for life-stage factors
 * - NRC 2006 Nutrient Requirements of Dogs and Cats — DER and water formulas
 * - FEDIAF 2024 — water intake guidance
 *
 * All AAFCO values are expressed PER KG OF DIET DRY MATTER.
 * The calculator separately computes per-1000-kcal-ME basis.
 */

// ----------------------------------------------------------------------------
// Species & Life Stage
// ----------------------------------------------------------------------------

export type Species = "dog" | "cat";

export type DogLifeStage =
  | "puppy_under_4mo"
  | "puppy_4mo_to_adult"
  | "adult_intact"
  | "adult_neutered"
  | "adult_obese_prone"
  | "adult_weight_loss"
  | "pregnant_after_d21"
  | "lactating"
  | "work_light"
  | "work_moderate"
  | "work_heavy";

export type CatLifeStage =
  | "kitten"
  | "adult_intact"
  | "adult_neutered"
  | "adult_obese_prone"
  | "adult_weight_loss"
  | "active"
  | "pregnant"
  | "lactating";

// ----------------------------------------------------------------------------
// Life-stage factors (DER multiplier on RER) — from user's reference tool
// ----------------------------------------------------------------------------

export interface LifeStageFactor {
  key: string;
  label_en: string;
  label_zh: string;
  label_th: string;
  factor: number; // single value; for ranges, use min/max
  min?: number;
  max?: number;
  isGrowth: boolean; // determines AAFCO Growth/Reproduction profile
}

export const DOG_LIFE_STAGES: Record<DogLifeStage, LifeStageFactor> = {
  puppy_under_4mo: {
    key: "puppy_under_4mo",
    label_en: "Puppy (<4 months)",
    label_zh: "幼犬（<4月龄）",
    label_th: "ลูกสุนัข (<4 เดือน)",
    factor: 3.0,
    isGrowth: true,
  },
  puppy_4mo_to_adult: {
    key: "puppy_4mo_to_adult",
    label_en: "Puppy (4 months → adult)",
    label_zh: "幼犬（4月龄至成年）",
    label_th: "ลูกสุนัข (4 เดือน-โต)",
    factor: 2.0,
    isGrowth: true,
  },
  adult_intact: {
    key: "adult_intact",
    label_en: "Adult (intact)",
    label_zh: "成犬（未绝育）",
    label_th: "สุนัขโต (ไม่ทำหมัน)",
    factor: 1.8,
    isGrowth: false,
  },
  adult_neutered: {
    key: "adult_neutered",
    label_en: "Adult (neutered)",
    label_zh: "成犬（已绝育）",
    label_th: "สุนัขโต (ทำหมัน)",
    factor: 1.6,
    isGrowth: false,
  },
  adult_obese_prone: {
    key: "adult_obese_prone",
    label_en: "Adult (obesity-prone)",
    label_zh: "成犬（易胖）",
    label_th: "สุนัขโต (อ้วนง่าย)",
    factor: 1.4,
    isGrowth: false,
  },
  adult_weight_loss: {
    key: "adult_weight_loss",
    label_en: "Adult (weight loss)",
    label_zh: "成犬（减肥）",
    label_th: "สุนัขโต (ลดน้ำหนัก)",
    factor: 1.0,
    isGrowth: false,
  },
  pregnant_after_d21: {
    key: "pregnant_after_d21",
    label_en: "Pregnant (after day 21)",
    label_zh: "妊娠期（>21天）",
    label_th: "ตั้งครรภ์ (หลังวันที่ 21)",
    factor: 3.0,
    isGrowth: true,
  },
  lactating: {
    key: "lactating",
    label_en: "Lactating",
    label_zh: "哺乳期",
    label_th: "ให้นมลูก",
    factor: 6.0,
    min: 4.0,
    max: 8.0,
    isGrowth: true,
  },
  work_light: {
    key: "work_light",
    label_en: "Working dog (light)",
    label_zh: "工作犬（轻度）",
    label_th: "สุนัขทำงาน (เบา)",
    factor: 2.0,
    isGrowth: false,
  },
  work_moderate: {
    key: "work_moderate",
    label_en: "Working dog (moderate)",
    label_zh: "工作犬（中度）",
    label_th: "สุนัขทำงาน (ปานกลาง)",
    factor: 3.0,
    isGrowth: false,
  },
  work_heavy: {
    key: "work_heavy",
    label_en: "Working dog (heavy)",
    label_zh: "工作犬（重度）",
    label_th: "สุนัขทำงาน (หนัก)",
    factor: 6.0,
    min: 4.0,
    max: 8.0,
    isGrowth: false,
  },
};

export const CAT_LIFE_STAGES: Record<CatLifeStage, LifeStageFactor> = {
  kitten: {
    key: "kitten",
    label_en: "Kitten",
    label_zh: "幼猫",
    label_th: "ลูกแมว",
    factor: 2.5,
    isGrowth: true,
  },
  adult_intact: {
    key: "adult_intact",
    label_en: "Adult (intact)",
    label_zh: "成猫（未绝育）",
    label_th: "แมวโต (ไม่ทำหมัน)",
    factor: 1.4,
    isGrowth: false,
  },
  adult_neutered: {
    key: "adult_neutered",
    label_en: "Adult (neutered)",
    label_zh: "成猫（已绝育）",
    label_th: "แมวโต (ทำหมัน)",
    factor: 1.2,
    isGrowth: false,
  },
  adult_obese_prone: {
    key: "adult_obese_prone",
    label_en: "Adult (obesity-prone)",
    label_zh: "成猫（易胖）",
    label_th: "แมวโต (อ้วนง่าย)",
    factor: 1.0,
    isGrowth: false,
  },
  adult_weight_loss: {
    key: "adult_weight_loss",
    label_en: "Adult (weight loss)",
    label_zh: "成猫（减肥）",
    label_th: "แมวโต (ลดน้ำหนัก)",
    factor: 0.9,
    min: 0.8,
    max: 1.0,
    isGrowth: false,
  },
  active: {
    key: "active",
    label_en: "Active adult",
    label_zh: "活跃成猫",
    label_th: "แมวโต (กระฉับกระเฉง)",
    factor: 1.6,
    isGrowth: false,
  },
  pregnant: {
    key: "pregnant",
    label_en: "Pregnant",
    label_zh: "妊娠期",
    label_th: "ตั้งครรภ์",
    factor: 1.8,
    min: 1.6,
    max: 2.0,
    isGrowth: true,
  },
  lactating: {
    key: "lactating",
    label_en: "Lactating",
    label_zh: "哺乳期",
    label_th: "ให้นมลูก",
    factor: 4.0,
    min: 2.0,
    max: 6.0,
    isGrowth: true,
  },
};

// ----------------------------------------------------------------------------
// AAFCO 2016 Profiles (per kg DM)
// ----------------------------------------------------------------------------

export interface AafcoNutrient {
  /** Maps to ingredient field key, e.g. "protein_g". Used for math, not display. */
  key: string;
  label_en: string;
  label_zh: string;
  label_th: string;
  /** Display unit (per kg DM). */
  unit: string;
  /** Adult Maintenance minimum. null = no requirement defined. */
  adultMin: number | null;
  /** Growth & Reproduction minimum. null = no requirement. */
  growthMin: number | null;
  /** Maximum (legal upper limit). null = no max. */
  max: number | null;
}

/** Crude protein min in g/kg DM = % × 10 */
const pct = (p: number) => p * 10;

export const AAFCO_DOG: AafcoNutrient[] = [
  { key: "protein_g",       label_en: "Crude protein",   label_zh: "粗蛋白",     label_th: "โปรตีน",          unit: "g/kg DM",  adultMin: pct(18.0), growthMin: pct(22.5), max: null },
  { key: "fat_g",           label_en: "Crude fat",       label_zh: "粗脂肪",     label_th: "ไขมัน",           unit: "g/kg DM",  adultMin: pct(5.5),  growthMin: pct(8.5),  max: null },
  { key: "calcium_mg",      label_en: "Calcium",         label_zh: "钙",         label_th: "แคลเซียม",        unit: "g/kg DM",  adultMin: 5000,      growthMin: 12000,     max: 25000 },
  { key: "phosphorus_mg",   label_en: "Phosphorus",      label_zh: "磷",         label_th: "ฟอสฟอรัส",        unit: "g/kg DM",  adultMin: 4000,      growthMin: 10000,     max: 16000 },
  { key: "potassium_mg",    label_en: "Potassium",       label_zh: "钾",         label_th: "โพแทสเซียม",      unit: "g/kg DM",  adultMin: 6000,      growthMin: 6000,      max: null },
  { key: "sodium_mg",       label_en: "Sodium",          label_zh: "钠",         label_th: "โซเดียม",         unit: "g/kg DM",  adultMin: 800,       growthMin: 3000,      max: null },
  { key: "magnesium_mg",    label_en: "Magnesium",       label_zh: "镁",         label_th: "แมกนีเซียม",      unit: "g/kg DM",  adultMin: 600,       growthMin: 400,       max: null },
  { key: "iron_mg",         label_en: "Iron",            label_zh: "铁",         label_th: "ธาตุเหล็ก",       unit: "mg/kg DM", adultMin: 40,        growthMin: 88,        max: null },
  { key: "copper_mg",       label_en: "Copper",          label_zh: "铜",         label_th: "ทองแดง",          unit: "mg/kg DM", adultMin: 7.3,       growthMin: 12.4,      max: null },
  { key: "manganese_mg",    label_en: "Manganese",       label_zh: "锰",         label_th: "แมงกานีส",        unit: "mg/kg DM", adultMin: 5.0,       growthMin: 7.2,       max: null },
  { key: "zinc_mg",         label_en: "Zinc",            label_zh: "锌",         label_th: "สังกะสี",         unit: "mg/kg DM", adultMin: 80,        growthMin: 100,       max: null },
  { key: "selenium_ug",     label_en: "Selenium",        label_zh: "硒",         label_th: "ซีลีเนียม",       unit: "μg/kg DM", adultMin: 350,       growthMin: 350,       max: 2000 },
  { key: "vit_a_re_ug",     label_en: "Vitamin A (RE)",  label_zh: "维生素A",    label_th: "วิตามินเอ",       unit: "μg/kg DM", adultMin: 1515,      growthMin: 1515,      max: 75000 },
  { key: "vit_d_ug",        label_en: "Vitamin D",       label_zh: "维生素D",    label_th: "วิตามินดี",       unit: "μg/kg DM", adultMin: 12.5,      growthMin: 12.5,      max: 750 },
  { key: "vit_e_mg",        label_en: "Vitamin E",       label_zh: "维生素E",    label_th: "วิตามินอี",       unit: "mg/kg DM", adultMin: 50,        growthMin: 50,        max: null },
  { key: "vit_b1_mg",       label_en: "Thiamine (B1)",   label_zh: "维生素B1",   label_th: "วิตามินบี1",      unit: "mg/kg DM", adultMin: 2.25,      growthMin: 2.25,      max: null },
  { key: "vit_b2_mg",       label_en: "Riboflavin (B2)", label_zh: "维生素B2",   label_th: "วิตามินบี2",      unit: "mg/kg DM", adultMin: 5.2,       growthMin: 5.2,       max: null },
  { key: "vit_b5_mg",       label_en: "Pantothenic (B5)",label_zh: "维生素B5",   label_th: "วิตามินบี5",      unit: "mg/kg DM", adultMin: 12,        growthMin: 12,        max: null },
  { key: "niacin_mg",       label_en: "Niacin (B3)",     label_zh: "维生素B3",   label_th: "วิตามินบี3",      unit: "mg/kg DM", adultMin: 13.6,      growthMin: 13.6,      max: null },
  { key: "vit_b6_mg",       label_en: "Pyridoxine (B6)", label_zh: "维生素B6",   label_th: "วิตามินบี6",      unit: "mg/kg DM", adultMin: 1.5,       growthMin: 1.5,       max: null },
  { key: "folate_mg",       label_en: "Folic acid",      label_zh: "叶酸",       label_th: "โฟเลต",           unit: "mg/kg DM", adultMin: 0.216,     growthMin: 0.216,     max: null },
  { key: "vit_b12_ug",      label_en: "Vitamin B12",     label_zh: "维生素B12",  label_th: "วิตามินบี12",     unit: "μg/kg DM", adultMin: 28,        growthMin: 28,        max: null },
  { key: "choline_mg",      label_en: "Choline",         label_zh: "胆碱",       label_th: "โคลีน",           unit: "mg/kg DM", adultMin: 1360,      growthMin: 1360,      max: null },
];

export const AAFCO_CAT: AafcoNutrient[] = [
  { key: "protein_g",       label_en: "Crude protein",   label_zh: "粗蛋白",     label_th: "โปรตีน",          unit: "g/kg DM",  adultMin: pct(26.0), growthMin: pct(30.0), max: null },
  { key: "fat_g",           label_en: "Crude fat",       label_zh: "粗脂肪",     label_th: "ไขมัน",           unit: "g/kg DM",  adultMin: pct(9.0),  growthMin: pct(9.0),  max: null },
  { key: "calcium_mg",      label_en: "Calcium",         label_zh: "钙",         label_th: "แคลเซียม",        unit: "g/kg DM",  adultMin: 6000,      growthMin: 10000,     max: null },
  { key: "phosphorus_mg",   label_en: "Phosphorus",      label_zh: "磷",         label_th: "ฟอสฟอรัส",        unit: "g/kg DM",  adultMin: 5000,      growthMin: 8000,      max: null },
  { key: "potassium_mg",    label_en: "Potassium",       label_zh: "钾",         label_th: "โพแทสเซียม",      unit: "g/kg DM",  adultMin: 6000,      growthMin: 6000,      max: null },
  { key: "sodium_mg",       label_en: "Sodium",          label_zh: "钠",         label_th: "โซเดียม",         unit: "g/kg DM",  adultMin: 200,       growthMin: 2000,      max: null },
  { key: "magnesium_mg",    label_en: "Magnesium",       label_zh: "镁",         label_th: "แมกนีเซียม",      unit: "g/kg DM",  adultMin: 400,       growthMin: 800,       max: null },
  { key: "iron_mg",         label_en: "Iron",            label_zh: "铁",         label_th: "ธาตุเหล็ก",       unit: "mg/kg DM", adultMin: 80,        growthMin: 80,        max: null },
  { key: "copper_mg",       label_en: "Copper",          label_zh: "铜",         label_th: "ทองแดง",          unit: "mg/kg DM", adultMin: 5.0,       growthMin: 15.0,      max: null },
  { key: "manganese_mg",    label_en: "Manganese",       label_zh: "锰",         label_th: "แมงกานีส",        unit: "mg/kg DM", adultMin: 7.5,       growthMin: 7.5,       max: null },
  { key: "zinc_mg",         label_en: "Zinc",            label_zh: "锌",         label_th: "สังกะสี",         unit: "mg/kg DM", adultMin: 75,        growthMin: 75,        max: null },
  { key: "selenium_ug",     label_en: "Selenium",        label_zh: "硒",         label_th: "ซีลีเนียม",       unit: "μg/kg DM", adultMin: 300,       growthMin: 300,       max: null },
  { key: "vit_a_re_ug",     label_en: "Vitamin A (RE)",  label_zh: "维生素A",    label_th: "วิตามินเอ",       unit: "μg/kg DM", adultMin: 1000,      growthMin: 2000,      max: 100000 },
  { key: "vit_d_ug",        label_en: "Vitamin D",       label_zh: "维生素D",    label_th: "วิตามินดี",       unit: "μg/kg DM", adultMin: 7.0,       growthMin: 7.0,       max: 752 },
  { key: "vit_e_mg",        label_en: "Vitamin E",       label_zh: "维生素E",    label_th: "วิตามินอี",       unit: "mg/kg DM", adultMin: 40,        growthMin: 40,        max: null },
  { key: "vit_b1_mg",       label_en: "Thiamine (B1)",   label_zh: "维生素B1",   label_th: "วิตามินบี1",      unit: "mg/kg DM", adultMin: 5.6,       growthMin: 5.6,       max: null },
  { key: "vit_b2_mg",       label_en: "Riboflavin (B2)", label_zh: "维生素B2",   label_th: "วิตามินบี2",      unit: "mg/kg DM", adultMin: 4.0,       growthMin: 4.0,       max: null },
  { key: "vit_b5_mg",       label_en: "Pantothenic (B5)",label_zh: "维生素B5",   label_th: "วิตามินบี5",      unit: "mg/kg DM", adultMin: 5.75,      growthMin: 5.75,      max: null },
  { key: "niacin_mg",       label_en: "Niacin (B3)",     label_zh: "维生素B3",   label_th: "วิตามินบี3",      unit: "mg/kg DM", adultMin: 60,        growthMin: 60,        max: null },
  { key: "vit_b6_mg",       label_en: "Pyridoxine (B6)", label_zh: "维生素B6",   label_th: "วิตามินบี6",      unit: "mg/kg DM", adultMin: 4.0,       growthMin: 4.0,       max: null },
  { key: "folate_mg",       label_en: "Folic acid",      label_zh: "叶酸",       label_th: "โฟเลต",           unit: "mg/kg DM", adultMin: 0.8,       growthMin: 0.8,       max: null },
  { key: "vit_b12_ug",      label_en: "Vitamin B12",     label_zh: "维生素B12",  label_th: "วิตามินบี12",     unit: "μg/kg DM", adultMin: 20,        growthMin: 20,        max: null },
  { key: "choline_mg",      label_en: "Choline",         label_zh: "胆碱",       label_th: "โคลีน",           unit: "mg/kg DM", adultMin: 2400,      growthMin: 2400,      max: null },
];

export function aafcoFor(species: Species): AafcoNutrient[] {
  return species === "dog" ? AAFCO_DOG : AAFCO_CAT;
}

// ----------------------------------------------------------------------------
// Macro-target benchmarks (% DM) — from Disk's spec
// ----------------------------------------------------------------------------

export interface MacroBenchmark {
  optimum: [number, number]; // [min, max]
  acceptable: [number, number];
}

export const MACRO_BENCHMARKS: Record<
  Species,
  Record<"normal" | "weight_loss", { protein: MacroBenchmark; fat: MacroBenchmark; carb: MacroBenchmark }>
> = {
  dog: {
    normal: {
      protein: { optimum: [40, 50],  acceptable: [35, 55] },
      fat:     { optimum: [15, 20],  acceptable: [10, 25] },
      carb:    { optimum: [20, 30],  acceptable: [30, 40] },
    },
    weight_loss: {
      protein: { optimum: [40, 50],  acceptable: [35, 55] },
      fat:     { optimum: [0, 10],   acceptable: [0, 12] },
      carb:    { optimum: [20, 30],  acceptable: [30, 40] },
    },
  },
  cat: {
    normal: {
      protein: { optimum: [50, 100], acceptable: [45, 100] },
      fat:     { optimum: [20, 30],  acceptable: [15, 35] },
      carb:    { optimum: [0, 10],   acceptable: [10, 20] },
    },
    weight_loss: {
      protein: { optimum: [50, 100], acceptable: [45, 100] },
      fat:     { optimum: [9, 15],   acceptable: [9, 18] },
      carb:    { optimum: [0, 10],   acceptable: [10, 20] },
    },
  },
};

// ----------------------------------------------------------------------------
// Modified Atwater factors for ME (kcal/g) — used for % ME view
// ----------------------------------------------------------------------------
export const ATWATER = {
  protein: 3.5,
  fat: 8.5,
  carb: 3.5,
};

// ----------------------------------------------------------------------------
// DER + Water formulas
// ----------------------------------------------------------------------------

/** RER = 70 × BW^0.75 (NRC 2006) */
export function rer(bodyWeightKg: number): number {
  if (!bodyWeightKg || bodyWeightKg <= 0) return 0;
  return 70 * Math.pow(bodyWeightKg, 0.75);
}

/** DER = RER × life-stage factor */
export function der(bodyWeightKg: number, factor: number): number {
  return rer(bodyWeightKg) * factor;
}

/** Water need (energy-coupled): ~1 mL per kcal DER (NRC 2006 / FEDIAF). */
export function waterFromEnergy(derKcal: number): number {
  return derKcal * 1.0;
}

/** Water need (body-weight rule): 50–60 mL per kg, midpoint 55. */
export function waterFromBodyWeight(bodyWeightKg: number): number {
  return bodyWeightKg * 55;
}
