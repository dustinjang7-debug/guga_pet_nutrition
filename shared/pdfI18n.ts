/**
 * Server-side i18n dictionary for PDF export.
 *
 * Mirrors keys we need from `client/src/lib/i18n.ts`. Kept separate so server
 * code (PDF generator, tests) doesn't pull in React-coupled client modules.
 *
 * Coverage = strict subset; only labels needed in the export. Adding a new
 * label means: add the key here for all 3 langs, then reference via `pt(...)`.
 */

export type PdfLang = "en" | "zh" | "th";

export interface PdfDict {
  // Header
  appName: string;
  tagline: string;
  generated_on: string;

  // Summary block
  summary_title: string;
  recipe_name: string;
  pet: string;
  species_dog: string;
  species_cat: string;
  body_weight: string;
  life_stage: string;
  life_stage_factor: string;
  total_grams: string;
  total_kcal: string;
  energy_density: string;
  daily_kcal_target: string;
  daily_feeding: string;
  saved_at: string;
  status_draft: string;
  status_approved: string;
  owner: string;
  pet_id: string;

  // Recipe table
  current_recipe_title: string;
  ingredient: string;
  grams_col: string;
  pct_col: string;
  kcal_col: string;

  // Macro profile
  macros_title: string;
  macro_protein: string;
  macro_fat: string;
  macro_carb: string;
  macro_fiber: string;
  macro_ash: string;
  macro_moisture: string;
  col_pct_dm: string;
  col_pct_me: string;
  col_grams: string;

  // Per-ingredient nutrient contribution
  nutrient_contrib_title: string;
  col_protein_g: string;
  col_fat_g: string;
  col_carb_g: string;
  col_fiber_g: string;
  col_water_g: string;
  total_row: string;

  // Notes
  notes_title: string;
  notes_empty: string;

  // AAFCO table
  aafco_title: string;
  aafco_subtitle: string;
  nutrient: string;
  per_kg_dm: string;
  aafco_min: string;
  aafco_max: string;
  status: string;
  status_below: string;
  status_borderline: string;
  status_ok: string;
  status_above: string;
  status_no_target: string;
  no_max: string;

  // Gap suggestions
  gaps_title: string;
  gaps_intro: string;
  gaps_none: string;
  gaps_shortfall: string;
  gaps_fresh_recommend: string;
  gaps_additive_recommend: string;
  gaps_grams_suffix: string;
  gaps_capped_note: string;

  // Footer
  footer_disclaimer: string;
  footer_page: string;
}

const en: PdfDict = {
  appName: "GUGA Pet Nutrition",
  tagline: "Fresh-food formulation, AAFCO-aligned",
  generated_on: "Generated",

  summary_title: "Summary",
  recipe_name: "Recipe",
  pet: "Pet",
  species_dog: "Dog",
  species_cat: "Cat",
  body_weight: "Body weight",
  life_stage: "Life stage",
  life_stage_factor: "Life-stage factor",
  total_grams: "Total weight",
  total_kcal: "Total calories",
  energy_density: "Energy density",
  daily_kcal_target: "Daily calorie target (DER)",
  daily_feeding: "Daily feeding amount",
  saved_at: "Saved",
  status_draft: "Draft",
  status_approved: "Approved",
  owner: "Owner",
  pet_id: "Pet ID",

  current_recipe_title: "Current Recipe",
  ingredient: "Ingredient",
  grams_col: "Grams",
  pct_col: "% of recipe",
  kcal_col: "kcal",

  macros_title: "Macronutrient Profile",
  macro_protein: "Protein",
  macro_fat: "Fat",
  macro_carb: "Carbohydrate",
  macro_fiber: "Fiber",
  macro_ash: "Ash / other",
  macro_moisture: "Moisture",
  col_pct_dm: "% DM",
  col_pct_me: "% ME",
  col_grams: "Grams",

  nutrient_contrib_title: "Per-ingredient Nutrients",
  col_protein_g: "Protein g",
  col_fat_g: "Fat g",
  col_carb_g: "Carb g",
  col_fiber_g: "Fiber g",
  col_water_g: "Water g",
  total_row: "Total",

  notes_title: "Notes",
  notes_empty: "(empty)",

  aafco_title: "AAFCO Compliance",
  aafco_subtitle: "Per kg dry matter, compared with the AAFCO 2016 profile.",
  nutrient: "Nutrient",
  per_kg_dm: "In recipe (per kg DM)",
  aafco_min: "AAFCO min",
  aafco_max: "AAFCO max",
  status: "Status",
  status_below: "Below",
  status_borderline: "Close",
  status_ok: "OK",
  status_above: "Above max",
  status_no_target: "—",
  no_max: "—",

  gaps_title: "Gap Suggestions",
  gaps_intro: "Recommended additions to close the AAFCO gaps below. Fresh ingredient = primary food choice; additive = pre-mix or supplement powder.",
  gaps_none: "All AAFCO targets met. No additions required.",
  gaps_shortfall: "Shortfall",
  gaps_fresh_recommend: "Fresh",
  gaps_additive_recommend: "Additive",
  gaps_grams_suffix: "g",
  gaps_capped_note: "(capped at safe max)",

  footer_disclaimer: "GUGA does not replace veterinary advice. Verify the recipe with a board-certified veterinary nutritionist before long-term feeding.",
  footer_page: "Page",
};

const zh: PdfDict = {
  appName: "GUGA 宠物营养",
  tagline: "鲜食配方，符合 AAFCO 标准",
  generated_on: "生成时间",

  summary_title: "概要",
  recipe_name: "配方名称",
  pet: "宠物",
  species_dog: "犬",
  species_cat: "猫",
  body_weight: "体重",
  life_stage: "生命阶段",
  life_stage_factor: "生命阶段因子",
  total_grams: "总重量",
  total_kcal: "总热量",
  energy_density: "能量密度",
  daily_kcal_target: "每日热量目标（DER）",
  daily_feeding: "每日喂食量",
  saved_at: "保存于",
  status_draft: "草稿",
  status_approved: "已批准",
  owner: "创建人",
  pet_id: "宠物编号",

  current_recipe_title: "当前配方",
  ingredient: "食材",
  grams_col: "克数",
  pct_col: "占比",
  kcal_col: "千卡",

  macros_title: "宏量营养素",
  macro_protein: "蛋白质",
  macro_fat: "脂肪",
  macro_carb: "碳水化合物",
  macro_fiber: "膳食纤维",
  macro_ash: "灰分/其他",
  macro_moisture: "水分",
  col_pct_dm: "干物质 %",
  col_pct_me: "代谢能 %",
  col_grams: "克数",

  nutrient_contrib_title: "各食材营养贡献",
  col_protein_g: "蛋白质 g",
  col_fat_g: "脂肪 g",
  col_carb_g: "碳水 g",
  col_fiber_g: "纤维 g",
  col_water_g: "水分 g",
  total_row: "合计",

  notes_title: "备注",
  notes_empty: "（无）",

  aafco_title: "AAFCO 合规",
  aafco_subtitle: "按每千克干物质计算，对照 AAFCO 2016 标准。",
  nutrient: "营养素",
  per_kg_dm: "配方含量（每千克 DM）",
  aafco_min: "AAFCO 最低",
  aafco_max: "AAFCO 最高",
  status: "状态",
  status_below: "不足",
  status_borderline: "接近",
  status_ok: "达标",
  status_above: "超标",
  status_no_target: "—",
  no_max: "—",

  gaps_title: "缺口建议",
  gaps_intro: "以下建议可以补足 AAFCO 缺口。鲜食 = 优先选择的食材；添加剂 = 预混料或补充粉。",
  gaps_none: "所有 AAFCO 指标均已达标，无需添加。",
  gaps_shortfall: "缺口",
  gaps_fresh_recommend: "鲜食",
  gaps_additive_recommend: "添加剂",
  gaps_grams_suffix: "克",
  gaps_capped_note: "（已封顶至安全上限）",

  footer_disclaimer: "GUGA 不能取代兽医建议。长期喂食前请由具备资质的宠物营养兽医师审核。",
  footer_page: "第",
};

const th: PdfDict = {
  appName: "GUGA โภชนาการสัตว์เลี้ยง",
  tagline: "สูตรอาหารสด สอดคล้อง AAFCO",
  generated_on: "สร้างเมื่อ",

  summary_title: "สรุป",
  recipe_name: "ชื่อสูตร",
  pet: "สัตว์เลี้ยง",
  species_dog: "สุนัข",
  species_cat: "แมว",
  body_weight: "น้ำหนักตัว",
  life_stage: "ช่วงวัย",
  life_stage_factor: "ตัวคูณช่วงวัย",
  total_grams: "น้ำหนักรวม",
  total_kcal: "พลังงานรวม",
  energy_density: "ความหนาแน่นพลังงาน",
  daily_kcal_target: "พลังงานต่อวัน (DER)",
  daily_feeding: "ปริมาณให้ต่อวัน",
  saved_at: "บันทึก",
  status_draft: "ฉบับร่าง",
  status_approved: "อนุมัติแล้ว",
  owner: "ผู้สร้าง",
  pet_id: "รหัสสัตว์เลี้ยง",

  current_recipe_title: "สูตรปัจจุบัน",
  ingredient: "วัตถุดิบ",
  grams_col: "กรัม",
  pct_col: "% ของสูตร",
  kcal_col: "kcal",

  macros_title: "สัดส่วนสารอาหารหลัก",
  macro_protein: "โปรตีน",
  macro_fat: "ไขมัน",
  macro_carb: "คาร์โบไฮเดรต",
  macro_fiber: "ใยอาหาร",
  macro_ash: "เถ้า/อื่น ๆ",
  macro_moisture: "ความชื้น",
  col_pct_dm: "% DM",
  col_pct_me: "% ME",
  col_grams: "กรัม",

  nutrient_contrib_title: "สารอาหารตามวัตถุดิบ",
  col_protein_g: "โปรตีน ก.",
  col_fat_g: "ไขมัน ก.",
  col_carb_g: "คาร์บ ก.",
  col_fiber_g: "ใย ก.",
  col_water_g: "น้ำ ก.",
  total_row: "รวม",

  notes_title: "บันทึกเพิ่มเติม",
  notes_empty: "(ว่าง)",

  aafco_title: "ความสอดคล้อง AAFCO",
  aafco_subtitle: "ต่อกิโลกรัมของวัตถุแห้ง เปรียบเทียบกับ AAFCO 2016",
  nutrient: "สารอาหาร",
  per_kg_dm: "ในสูตร (ต่อกก. DM)",
  aafco_min: "AAFCO ต่ำสุด",
  aafco_max: "AAFCO สูงสุด",
  status: "สถานะ",
  status_below: "ต่ำกว่า",
  status_borderline: "ใกล้ขีด",
  status_ok: "ผ่าน",
  status_above: "เกินขีดสูง",
  status_no_target: "—",
  no_max: "—",

  gaps_title: "ข้อเสนอเติมช่องโหว่",
  gaps_intro: "วัตถุดิบและสารเสริมแนะนำเพื่อปิดช่องโหว่ AAFCO ด้านล่าง วัตถุดิบสด = ตัวเลือกหลัก สารเสริม = พรีมิกซ์/ผงเสริม",
  gaps_none: "ครบทุกค่า AAFCO ไม่ต้องเสริมเพิ่มเติม",
  gaps_shortfall: "ช่องโหว่",
  gaps_fresh_recommend: "วัตถุดิบสด",
  gaps_additive_recommend: "สารเสริม",
  gaps_grams_suffix: "ก.",
  gaps_capped_note: "(จำกัดที่เพดานปลอดภัย)",

  footer_disclaimer: "GUGA ไม่ใช่คำแนะนำทางสัตวแพทย์ กรุณาให้สัตวแพทย์โภชนาการรับรองก่อนใช้งานต่อเนื่อง",
  footer_page: "หน้า",
};

export const PDF_DICT: Record<PdfLang, PdfDict> = { en, zh, th };

export function pt(lang: PdfLang, key: keyof PdfDict): string {
  return PDF_DICT[lang][key] ?? PDF_DICT.en[key];
}
