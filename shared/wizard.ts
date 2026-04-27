/**
 * GUGA Pet Nutrition — Guided Wizard step configuration.
 *
 * Each step targets a specific nutrient/macro and offers default suggestions
 * sourced from the verified ingredient database. The nutritionist can accept
 * the suggestion, choose another ingredient from a sortable shortlist, or skip
 * the step entirely (e.g. if the nutrient is already met by previous additions).
 */

import type { Species } from "./aafco";

export interface WizardStep {
  /** Stable id used for navigation and progress tracking. */
  id: string;
  /** Human-readable step labels. */
  title_en: string;
  title_zh: string;
  title_th: string;
  /** Short description shown under the title. */
  desc_en: string;
  desc_zh: string;
  desc_th: string;
  /**
   * Nutrient field key this step is trying to satisfy. Used to compute progress
   * against AAFCO. Match keys in `Ingredient` interface.
   * `null` for macro-only steps (Protein/Carbs).
   */
  nutrientKey: string | null;
  /**
   * The category of action — controls which ingredients are eligible and
   * the default suggestion logic.
   */
  kind:
    | "macro_protein"
    | "macro_carb"
    | "vit_a"
    | "vit_b_complex"
    | "choline"
    | "vit_e_oil"
    | "vit_d"
    | "iron"
    | "zinc"
    | "calcium"
    | "phosphorus"
    | "sodium";
  /**
   * Pre-selected default ingredient(s) and grams. When the nutritionist clicks
   * "Add suggestion", these go into the recipe.
   */
  defaults: Array<{
    /** Ingredient ID in the verified DB. */
    ingredientId: number;
    /** Default grams to add. Can be a percentage of starting volume or a fixed range. */
    grams: number;
    /** Optional grams range so UI can show a slider. */
    gramsRange?: [number, number];
    /** If true the grams is a % of starting volume rather than absolute. */
    isPercentOfVolume?: boolean;
  }>;
  /**
   * IDs of additional alternative ingredients the user can swap in. UI sorts
   * the full DB by `nutrientKey` and adds these as "starred" suggestions.
   */
  alternatives?: number[];
  /** Categories the picker can filter to during this step. */
  allowedCategories?: string[];
  /** Helper text shown below the suggestion (e.g., "5–10% of starting volume"). */
  hint_en?: string;
  hint_zh?: string;
  hint_th?: string;
}

/**
 * Wizard step list. Order matters — user moves forward through these steps.
 * Same flow is used for dogs and cats; defaults differ by species inside the
 * UI (e.g., cats get a higher protein target).
 */
export const WIZARD_STEPS: WizardStep[] = [
  // ------------------------------------------------------------------
  // Step 1: Protein (Meat / Poultry / Fish / Seafood / Egg)
  // ------------------------------------------------------------------
  {
    id: "protein",
    title_en: "Protein",
    title_zh: "蛋白质",
    title_th: "โปรตีน",
    desc_en:
      "Pick the main protein source(s). Aim for the protein target set in your recipe profile.",
    desc_zh: "选择主要蛋白质来源,达到配方文件中设定的蛋白质目标。",
    desc_th: "เลือกแหล่งโปรตีนหลัก ให้ตรงกับเป้าหมายโปรตีนในโปรไฟล์สูตร",
    nutrientKey: "protein_g",
    kind: "macro_protein",
    defaults: [
      // Chicken breast — clean default lean protein
      { ingredientId: 65, grams: 400 },
    ],
    alternatives: [47, 65, 69, 49, 54, 133, 142, 198, 81, 82], // beef lean, chicken breast, duck breast, rabbit, lamb lean, salmon, cod, sardine, egg yolk, duck egg
    allowedCategories: ["Meat", "Poultry", "Fish", "Seafood", "Egg"],
    hint_en: "Recommended: 30–50% of starting volume.",
    hint_zh: "建议:配方初始重量的30–50%。",
    hint_th: "แนะนำ: 30–50% ของน้ำหนักเริ่มต้น",
  },

  // ------------------------------------------------------------------
  // Step 2: Carbohydrates - Grains
  // ------------------------------------------------------------------
  {
    id: "carb_grain",
    title_en: "Carbohydrates — Grains",
    title_zh: "碳水化合物 — 谷物",
    title_th: "คาร์โบไฮเดรต — ธัญพืช",
    desc_en:
      "Add grains. Combined grain + root should not exceed your carb target. Suggested 50/50 split with roots.",
    desc_zh: "加入谷物。谷物+根茎合计不超过碳水目标。建议谷物根茎各占50%。",
    desc_th: "เพิ่มธัญพืช รวมกับรากให้ไม่เกินเป้าหมายคาร์บ แนะนำ 50/50 กับราก",
    nutrientKey: "carb_g",
    kind: "macro_carb",
    defaults: [
      // White rice as a clean, well-tolerated default
      { ingredientId: 1, grams: 100 },
    ],
    alternatives: [1, 3, 5, 6, 8, 11, 12], // rice white, rice black, wheat flour std, wheat flour refined, millet, oats, quinoa
    allowedCategories: ["Grain"],
    hint_en: "About half of your carb target should come from grains.",
    hint_zh: "碳水目标的约一半应来自谷物。",
    hint_th: "ประมาณครึ่งหนึ่งของเป้าคาร์บควรมาจากธัญพืช",
  },

  // ------------------------------------------------------------------
  // Step 3: Carbohydrates - Roots
  // ------------------------------------------------------------------
  {
    id: "carb_root",
    title_en: "Carbohydrates — Roots & Tubers",
    title_zh: "碳水化合物 — 根茎类",
    title_th: "คาร์โบไฮเดรต — ราก & หัว",
    desc_en:
      "Add roots/tubers. Together with grains, do not exceed the carb target.",
    desc_zh: "加入根茎类。与谷物合计不超过碳水目标。",
    desc_th: "เพิ่มรากและหัว รวมกับธัญพืชต้องไม่เกินเป้าหมายคาร์บ",
    nutrientKey: "carb_g",
    kind: "macro_carb",
    defaults: [
      // Sweet potato (red flesh) — vitamin A bonus
      { ingredientId: 27, grams: 100 },
    ],
    alternatives: [27, 28, 95, 30, 26, 29, 94], // sweet potato red, sweet potato white, potato, taro, water chestnut, carrot, daikon
    allowedCategories: ["Root"],
    hint_en: "Other half of carb target.",
    hint_zh: "碳水目标的另一半。",
    hint_th: "อีกครึ่งหนึ่งของเป้าคาร์บ",
  },

  // ------------------------------------------------------------------
  // Step 4: Vitamin A (Liver)
  // ------------------------------------------------------------------
  {
    id: "vit_a",
    title_en: "Vitamin A — Animal Liver",
    title_zh: "维生素A — 动物肝脏",
    title_th: "วิตามินเอ — ตับสัตว์",
    desc_en:
      "Liver is the densest natural Vitamin A source. ~5–10% of starting volume is usually enough.",
    desc_zh: "肝脏是天然维生素A最佳来源,约配方初始重量的5-10%即可。",
    desc_th: "ตับคือแหล่งวิตามินเอที่เข้มข้นที่สุด ประมาณ 5-10% ของน้ำหนักเริ่มต้นพอ",
    nutrientKey: "vit_a_re_ug",
    kind: "vit_a",
    defaults: [
      // Chicken liver (62) — moderate density, easy to source
      { ingredientId: 62, grams: 70, gramsRange: [50, 100] },
    ],
    alternatives: [62, 44, 52, 58, 68, 200, 64, 114], // chicken liver, beef, lamb, pork, duck, goose liver; chicken heart; broccoli
    allowedCategories: ["Organ", "Vegetable", "Fish"],
    hint_en: "Lamb/beef liver are 2× richer than chicken liver — use less.",
    hint_zh: "羊肝/牛肝维生素A密度比鸡肝高2倍,用量减半即可。",
    hint_th: "ตับแกะ/วัวมีวิตามินเอเข้มข้นกว่าตับไก่ 2 เท่า — ใช้น้อยลง",
  },

  // ------------------------------------------------------------------
  // Step 5: Vitamin B Complex (Brewer's Yeast)
  // ------------------------------------------------------------------
  {
    id: "vit_b",
    title_en: "B Vitamins — Brewer's Yeast",
    title_zh: "B族维生素 — 啤酒酵母",
    title_th: "วิตามินบี — ยีสต์เบียร์",
    desc_en:
      "We check ALL B vitamins (B1, B2, B3, B5, B6, folate, B12) against AAFCO. If any are below min, add brewer's yeast — capped at 2% of recipe weight.",
    desc_zh: "检查全部B族维生素（B1, B2, B3, B5, B6, 叶酸, B12）是否达到AAFCO。不足时加入啤酒酵母，上限为配方重量的 2%。",
    desc_th: "ยีสต์เบียร์ครอบคลุมวิตามินบีส่วนใหญ่ ประมาณ 2% ของน้ำหนักเริ่มต้น",
    // nutrientKey is left as vit_b1_mg only as a fallback for the per-ingredient
    // density display in the picker; the wizard's pass/fail logic for this step
    // uses bComplexReport() to evaluate ALL B vitamins (B1, B2, B3, B5, B6,
    // folate, B12) against AAFCO. Choline has its own dedicated step.
    nutrientKey: "vit_b1_mg",
    kind: "vit_b_complex",
    defaults: [
      // Brewer's yeast (157) — 2% of 1000g = 20g
      { ingredientId: 157, grams: 20, gramsRange: [10, 30] },
    ],
    alternatives: [157, 7, 5], // brewer's yeast, wheat germ, wheat flour standard
    allowedCategories: ["Supplement", "Grain"],
    hint_en: "20g per 1kg of starting volume is a good baseline.",
    hint_zh: "每1kg初始重量加20g是一个良好基准。",
    hint_th: "20 กรัมต่อน้ำหนักเริ่มต้น 1 กก. คือค่าพื้นฐานที่ดี",
  },

  // ------------------------------------------------------------------
  // Step 6: Choline (Egg yolk / Broccoli)
  // ------------------------------------------------------------------
  {
    id: "choline",
    title_en: "Choline — Egg Yolk or Broccoli",
    title_zh: "胆碱 — 蛋黄或西兰花",
    title_th: "โคลีน — ไข่แดง หรือ บรอกโคลี",
    desc_en:
      "Egg yolk is the most concentrated source. Start with 20–40g; broccoli (~50g) is a plant alternative.",
    desc_zh: "蛋黄是胆碱最浓缩的来源。建议起始20–40g;西兰花(50g)可作植物替代。",
    desc_th: "ไข่แดงคือแหล่งโคลีนที่เข้มข้นที่สุด เริ่มที่ 20-40 กรัม บรอกโคลี (50 กรัม) คือทางเลือกพืช",
    nutrientKey: "choline_mg",
    kind: "choline",
    defaults: [
      // Egg yolk (81)
      { ingredientId: 81, grams: 30, gramsRange: [20, 40] },
    ],
    alternatives: [81, 114, 86, 44, 80, 78, 62], // egg yolk, broccoli, clam, beef liver, chicken egg, quail egg, chicken liver
    allowedCategories: ["Egg", "Vegetable", "Seafood", "Organ"],
    hint_en: "Egg yolk also boosts Vitamin D.",
    hint_zh: "蛋黄同时补充维生素D。",
    hint_th: "ไข่แดงยังเพิ่มวิตามินดีด้วย",
  },

  // ------------------------------------------------------------------
  // Step 7: Vitamin E (Vegetable oil)
  // ------------------------------------------------------------------
  {
    id: "vit_e",
    title_en: "Vitamin E & Healthy Fats — Vegetable Oil",
    title_zh: "维生素E与脂肪 — 植物油",
    title_th: "วิตามินอี & ไขมันดี — น้ำมันพืช",
    desc_en:
      "Vegetable oil supplies Vitamin E and balances fat ratio. 10–30g depending on oil choice.",
    desc_zh: "植物油提供维生素E并平衡脂肪比例,根据油种类用量10–30g。",
    desc_th: "น้ำมันพืชให้วิตามินอีและช่วยปรับสมดุลไขมัน 10-30 กรัม ตามชนิดน้ำมัน",
    nutrientKey: "vit_e_mg",
    kind: "vit_e_oil",
    defaults: [
      // Sunflower oil (150) - high VitE, neutral
      { ingredientId: 150, grams: 15, gramsRange: [10, 30] },
    ],
    alternatives: [148, 235, 147, 150, 152, 199, 234, 236, 149], // soybean, sesame, canola, sunflower, corn, flaxseed, tea, olive, peanut
    allowedCategories: ["Oil"],
    hint_en: "Soybean oil has the highest Vit E; flaxseed adds omega-3.",
    hint_zh: "豆油维生素E含量最高;亚麻籽油富含omega-3。",
    hint_th: "น้ำมันถั่วเหลืองมีวิตามินอีสูงสุด น้ำมันเมล็ดแฟลกซ์เพิ่มโอเมก้า-3",
  },

  // ------------------------------------------------------------------
  // Step 8: Vitamin D (Egg yolk / Fish)
  // ------------------------------------------------------------------
  {
    id: "vit_d",
    title_en: "Vitamin D — Fish or Egg Yolk",
    title_zh: "维生素D — 鱼类或蛋黄",
    title_th: "วิตามินดี — ปลา หรือ ไข่แดง",
    desc_en:
      "If your recipe is low on Vit D, add fatty fish or extra egg yolk. Skip if already met.",
    desc_zh: "若维生素D不足,可加深海鱼或额外蛋黄。已达标可跳过。",
    desc_th: "ถ้าวิตามินดีต่ำ ให้เพิ่มปลาที่มีไขมัน หรือไข่แดง ข้ามถ้าตรงเป้าหมายแล้ว",
    nutrientKey: "vit_d_ug",
    kind: "vit_d",
    defaults: [
      // Salmon (133) - clean default
      { ingredientId: 133, grams: 50, gramsRange: [30, 80] },
    ],
    alternatives: [133, 130, 142, 135, 132, 81, 200, 52, 62], // salmon, mackerel, cod, anchovy, hairtail, egg yolk, goose liver, lamb liver, chicken liver
    allowedCategories: ["Fish", "Egg", "Organ"],
    hint_en: "Egg yolk and liver from earlier steps may already cover this.",
    hint_zh: "前面步骤的蛋黄和肝脏可能已经满足。",
    hint_th: "ไข่แดงและตับจากขั้นตอนก่อนหน้าอาจครอบคลุมไปแล้ว",
  },

  // ------------------------------------------------------------------
  // Step 9: Iron (mostly already from meat + liver)
  // ------------------------------------------------------------------
  {
    id: "iron",
    title_en: "Iron",
    title_zh: "铁",
    title_th: "ธาตุเหล็ก",
    desc_en:
      "Meat and liver from earlier steps usually meet iron needs. If short, add duck/pork liver or animal blood.",
    desc_zh: "前面步骤的肉与肝通常已满足铁需求。若不足可加鸭肝、猪肝或动物血。",
    desc_th: "เนื้อและตับจากก่อนหน้ามักให้ธาตุเหล็กพอแล้ว ถ้าขาด ให้เพิ่มตับเป็ด/หมู หรือเลือดสัตว์",
    nutrientKey: "iron_mg",
    kind: "iron",
    defaults: [
      // Duck liver (68) - small top-up if needed
      { ingredientId: 68, grams: 30, gramsRange: [20, 50] },
    ],
    alternatives: [68, 72, 66, 58, 52, 44, 156, 39], // duck liver, duck blood, chicken blood, pork liver, lamb liver, beef liver, sesame seed, nori
    allowedCategories: ["Organ", "Nut/Seed", "Vegetable"],
    hint_en: "Skip this step if iron is already at AAFCO target.",
    hint_zh: "若铁已达标可跳过此步。",
    hint_th: "ข้ามขั้นนี้ถ้าธาตุเหล็กถึงเป้า AAFCO แล้ว",
  },

  // ------------------------------------------------------------------
  // Step 10: Zinc (Shellfish)
  // ------------------------------------------------------------------
  {
    id: "zinc",
    title_en: "Zinc — Shellfish",
    title_zh: "锌 — 贝类",
    title_th: "สังกะสี — หอย",
    desc_en:
      "Shellfish are the densest zinc source. ~30g of oysters covers most recipes.",
    desc_zh: "贝类是最丰富的锌来源,约30g牡蛎即可满足大多数配方。",
    desc_th: "หอยเป็นแหล่งสังกะสีที่เข้มข้นที่สุด ประมาณ 30 กรัมหอยนางรมก็พอสำหรับส่วนใหญ่",
    nutrientKey: "zinc_mg",
    kind: "zinc",
    defaults: [
      // Raw oyster (89) - 71.2 mg/100g!
      { ingredientId: 89, grams: 30, gramsRange: [20, 50] },
    ],
    alternatives: [89, 88, 91, 86, 7, 232, 156, 39], // raw oyster, oyster, scallop, clam, wheat germ, pumpkin seed, sesame, nori
    allowedCategories: ["Seafood", "Nut/Seed", "Grain", "Vegetable"],
    hint_en: "Wheat germ (~30g) is a plant alternative if avoiding shellfish.",
    hint_zh: "若不用贝类,可加约30g小麦胚芽作替代。",
    hint_th: "จมูกข้าวสาลี (~30 กรัม) เป็นทางเลือกพืชหากเลี่ยงหอย",
  },

  // ------------------------------------------------------------------
  // Step 11: Calcium (Eggshell powder)
  // ------------------------------------------------------------------
  {
    id: "calcium",
    title_en: "Calcium — Eggshell Powder",
    title_zh: "钙 — 蛋壳粉",
    title_th: "แคลเซียม — ผงเปลือกไข่",
    desc_en:
      "Eggshell powder is the cleanest calcium source. ~6–7g per 1kg of starting volume.",
    desc_zh: "蛋壳粉是最干净的钙源。每1kg初始重量约加6–7g。",
    desc_th: "ผงเปลือกไข่เป็นแหล่งแคลเซียมที่สะอาดที่สุด ประมาณ 6-7 กรัม ต่อน้ำหนักเริ่มต้น 1 กก.",
    nutrientKey: "calcium_mg",
    kind: "calcium",
    defaults: [
      // Eggshell powder (159)
      { ingredientId: 159, grams: 6, gramsRange: [4, 10] },
    ],
    alternatives: [159, 198, 84], // eggshell powder, sardine, dried scallop
    allowedCategories: ["Supplement", "Fish", "Seafood"],
    hint_en: "1g eggshell powder ≈ 380mg Ca. Don't exceed AAFCO max!",
    hint_zh: "1g蛋壳粉≈380mg钙,注意不超AAFCO上限!",
    hint_th: "1 กรัมผงเปลือกไข่ ≈ 380 มก. แคลเซียม อย่าเกินค่าสูงสุดของ AAFCO!",
  },

  // ------------------------------------------------------------------
  // Step 12: Phosphorus (Wheat germ if needed)
  // ------------------------------------------------------------------
  {
    id: "phosphorus",
    title_en: "Phosphorus",
    title_zh: "磷",
    title_th: "ฟอสฟอรัส",
    desc_en:
      "Meat and liver provide most phosphorus. If still short, add wheat germ.",
    desc_zh: "肉与肝已提供大部分磷。若仍不足可加小麦胚芽。",
    desc_th: "เนื้อและตับให้ฟอสฟอรัสส่วนใหญ่ ถ้ายังขาด ให้เพิ่มจมูกข้าวสาลี",
    nutrientKey: "phosphorus_mg",
    kind: "phosphorus",
    defaults: [
      // Wheat germ (7)
      { ingredientId: 7, grams: 20, gramsRange: [10, 40] },
    ],
    alternatives: [7, 232, 156, 84, 89, 198], // wheat germ, pumpkin seed, sesame, dried scallop, oyster, sardine
    allowedCategories: ["Grain", "Nut/Seed", "Seafood", "Fish"],
    hint_en: "Skip if Ca:P ratio already in target zone.",
    hint_zh: "若钙磷比已在目标区可跳过。",
    hint_th: "ข้ามถ้าอัตราส่วน Ca:P อยู่ในเป้าหมายแล้ว",
  },

  // ------------------------------------------------------------------
  // Step 13: Sodium (Salt as last resort)
  // ------------------------------------------------------------------
  {
    id: "sodium",
    title_en: "Sodium — Salt",
    title_zh: "钠 — 食盐",
    title_th: "โซเดียม — เกลือ",
    desc_en:
      "If sodium is below the AAFCO floor, add a small pinch of salt. Skip otherwise.",
    desc_zh: "若钠低于AAFCO下限,可加少许食盐。已达标可跳过。",
    desc_th: "ถ้าโซเดียมต่ำกว่าค่าต่ำสุดของ AAFCO ให้เติมเกลือเล็กน้อย ข้ามถ้าไม่จำเป็น",
    nutrientKey: "sodium_mg",
    kind: "sodium",
    defaults: [
      // Salt (154)
      { ingredientId: 154, grams: 1, gramsRange: [0.5, 3] },
    ],
    alternatives: [154, 198, 84, 89], // salt, sardine, dried scallop, oyster
    allowedCategories: ["Supplement", "Fish", "Seafood"],
    hint_en: "1g of salt ≈ 393mg sodium. Don't over-salt!",
    hint_zh: "1g盐≈393mg钠,切勿过量!",
    hint_th: "1 กรัมเกลือ ≈ 393 มก. โซเดียม อย่าเค็มเกิน!",
  },
];

/**
 * Adjust starting protein default per species — cats need more.
 * The wizard UI uses this to override the step's grams default.
 */
export function suggestedProteinGrams(species: Species, startingVolumeG: number): number {
  // Dog: ~40% of starting volume; Cat: ~50%
  return Math.round(startingVolumeG * (species === "cat" ? 0.5 : 0.4));
}

export function suggestedCarbGrams(species: Species, startingVolumeG: number): number {
  // Dog: ~25% (split 12.5% grain + 12.5% root)
  // Cat: ~10% (split 5% + 5%)
  return Math.round(startingVolumeG * (species === "cat" ? 0.1 : 0.25));
}

/** Total step count for progress UI. */
export const TOTAL_WIZARD_STEPS = WIZARD_STEPS.length;
