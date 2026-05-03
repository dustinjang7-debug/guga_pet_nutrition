/**
 * Recipe PDF generator (server-side, PDFKit).
 *
 * Renders Summary + Current Recipe + AAFCO comparison + Gap suggestions to a
 * single PDF in EN, ZH or TH. Fonts are bundled in `server/fonts/` so output
 * works offline and across all 3 scripts.
 *
 * Layout discipline: every section calls `resetCursor(doc)` first, every
 * `text(x,y,opts)` uses `lineBreak: false` so PDFKit doesn't leak a column
 * width into subsequent calls, and we manually manage `doc.y` after each row.
 *
 * Public surface = `generateRecipePdf(input)` returns a Buffer.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

import {
  AAFCO_CAT,
  AAFCO_DOG,
  CAT_LIFE_STAGES,
  DOG_LIFE_STAGES,
  type Species,
} from "@shared/aafco";
import {
  aafcoComparison,
  type AafcoRow,
  dailyFeed,
  recipeMacros,
  recipeTotals,
  type RecipeMacros,
  type NutrientTotals,
} from "@shared/calc";
import { suggestRemediations, formatGrams } from "@shared/gapSuggester";
import { INGREDIENT_BY_ID } from "@shared/ingredients";
import { type PdfLang, pt } from "@shared/pdfI18n";

// ---- Constants ----------------------------------------------------------

const PAGE_MARGIN = 40;
const FOOTER_RESERVE = 40;
const COLOR = {
  text: "#222222",
  muted: "#6b6b6b",
  border: "#d6d6d6",
  primary: "#2f4f3a",
  primaryFaded: "#e9efe9",
  ok: "#3f9763",
  borderline: "#c98a2b",
  below: "#c44141",
  above: "#9a4a8a",
  zebra: "#fafaf7",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FONT_DIR = (() => {
  const candidates = [
    path.resolve(__dirname, "fonts"),
    path.resolve(__dirname, "../server/fonts"),
    path.resolve(__dirname, "../fonts"),
    path.resolve(process.cwd(), "server/fonts"),
    path.resolve(process.cwd(), "fonts"),
  ];
  const found = candidates.find(p => fs.existsSync(path.join(p, "NotoSans-Regular.ttf")));
  return found ?? candidates[0];
})();

function fontPathFor(lang: PdfLang): { regular: string; bold: string } {
  switch (lang) {
    case "zh":
      return {
        regular: path.join(FONT_DIR, "NotoSansSC-Regular.ttf"),
        bold: path.join(FONT_DIR, "NotoSansSC-Bold.ttf"),
      };
    case "th":
      // Sarabun bundles Thai + Latin glyphs (NotoSansThai is Thai-only).
      return {
        regular: path.join(FONT_DIR, "Sarabun-Regular.ttf"),
        bold: path.join(FONT_DIR, "Sarabun-Bold.ttf"),
      };
    default:
      return {
        regular: path.join(FONT_DIR, "NotoSans-Regular.ttf"),
        bold: path.join(FONT_DIR, "NotoSans-Bold.ttf"),
      };
  }
}

export interface GeneratePdfInput {
  lang: PdfLang;
  recipe: {
    name: string;
    petName?: string | null;
    species: Species;
    lifeStageKey: string;
    bodyWeightKg: number;
    lifeStageFactor: number;
    items: { ingredientId: number; grams: number }[];
    notes?: string | null;
    status: "draft" | "approved";
    updatedAt?: Date | null;
  };
}

// ---- helpers -----------------------------------------------------------

function ingredientName(
  ing: { name_en: string; name_zh: string; name_th: string },
  lang: PdfLang,
): string {
  if (lang === "zh") return ing.name_zh || ing.name_en;
  if (lang === "th") return ing.name_th || ing.name_en;
  return ing.name_en || ing.name_zh;
}

function lifeStageLabel(species: Species, key: string, lang: PdfLang): string {
  const map = species === "dog" ? DOG_LIFE_STAGES : CAT_LIFE_STAGES;
  const ls = (map as Record<string, { label_en: string; label_zh: string; label_th: string } | undefined>)[key];
  if (!ls) return key;
  if (lang === "zh") return ls.label_zh;
  if (lang === "th") return ls.label_th;
  return ls.label_en;
}

function aafcoLabel(
  row: { label_en: string; label_zh: string; label_th: string },
  lang: PdfLang,
): string {
  if (lang === "zh") return row.label_zh;
  if (lang === "th") return row.label_th;
  return row.label_en;
}

function statusLabel(lang: PdfLang, status: AafcoRow["status"]): string {
  switch (status) {
    case "below": return pt(lang, "status_below");
    case "borderline": return pt(lang, "status_borderline");
    case "ok": return pt(lang, "status_ok");
    case "above": return pt(lang, "status_above");
    default: return pt(lang, "status_no_target");
  }
}

function statusColor(status: AafcoRow["status"]): string {
  switch (status) {
    case "below": return COLOR.below;
    case "borderline": return COLOR.borderline;
    case "ok": return COLOR.ok;
    case "above": return COLOR.above;
    default: return COLOR.muted;
  }
}

function fmt(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(decimals);
}

function fmtUnit(n: number | null, unit: string): string {
  if (n === null) return "—";
  return `${fmt(n)} ${unit.split(" ")[0]}`;
}

function isGrowthLifeStage(species: Species, key: string): boolean {
  const map = species === "dog" ? DOG_LIFE_STAGES : CAT_LIFE_STAGES;
  return (map as Record<string, { isGrowth: boolean } | undefined>)[key]?.isGrowth ?? false;
}

/** Reset cursor to left margin and prevent column-width from leaking. */
function resetCursor(doc: PDFKit.PDFDocument, y?: number) {
  doc.x = PAGE_MARGIN;
  if (y !== undefined) doc.y = y;
}

function pageWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - PAGE_MARGIN * 2;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - FOOTER_RESERVE) {
    doc.addPage();
    resetCursor(doc, PAGE_MARGIN);
  }
}

// ---- Section renderers --------------------------------------------------

function drawHeader(doc: PDFKit.PDFDocument, lang: PdfLang) {
  const top = PAGE_MARGIN;
  doc.save();
  doc.roundedRect(PAGE_MARGIN, top, 28, 28, 4).fill(COLOR.primary);
  doc.fillColor("#ffffff").font("BoldFont").fontSize(16).text("G", PAGE_MARGIN + 8.5, top + 4, { lineBreak: false });
  doc.restore();

  doc.fillColor(COLOR.text).font("BoldFont").fontSize(13)
    .text(pt(lang, "appName"), PAGE_MARGIN + 38, top + 1, { width: 260, lineBreak: false });
  doc.fillColor(COLOR.muted).font("RegularFont").fontSize(8)
    .text(pt(lang, "tagline"), PAGE_MARGIN + 38, top + 17, { width: 260, lineBreak: false });

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.fillColor(COLOR.muted).font("RegularFont").fontSize(8)
    .text(`${pt(lang, "generated_on")}: ${dateStr}`,
      doc.page.width - PAGE_MARGIN - 200, top + 4,
      { width: 200, align: "right", lineBreak: false });

  doc.moveTo(PAGE_MARGIN, top + 36).lineTo(doc.page.width - PAGE_MARGIN, top + 36)
    .lineWidth(0.5).strokeColor(COLOR.border).stroke();

  resetCursor(doc, top + 50);
}

function drawSectionTitle(doc: PDFKit.PDFDocument, label: string) {
  ensureSpace(doc, 28);
  resetCursor(doc);
  doc.font("BoldFont").fontSize(11).fillColor(COLOR.primary)
    .text(label.toUpperCase(), PAGE_MARGIN, doc.y, {
      width: pageWidth(doc),
      lineBreak: false,
      characterSpacing: 0.6,
    });
  const yLine = doc.y + 2;
  doc.moveTo(PAGE_MARGIN, yLine).lineTo(doc.page.width - PAGE_MARGIN, yLine)
    .lineWidth(0.5).strokeColor(COLOR.primary).stroke();
  resetCursor(doc, yLine + 8);
}

function drawSummary(doc: PDFKit.PDFDocument, lang: PdfLang, input: GeneratePdfInput,
  _totals: NutrientTotals, macros: RecipeMacros) {
  drawSectionTitle(doc, pt(lang, "summary_title"));

  const r = input.recipe;
  const speciesLabel = r.species === "dog" ? pt(lang, "species_dog") : pt(lang, "species_cat");
  const der = dailyFeed(r.bodyWeightKg, r.lifeStageFactor, macros);

  const rows: [string, string][] = [
    [pt(lang, "recipe_name"), r.name],
    [pt(lang, "pet"),
      `${r.petName ? `${r.petName} · ` : ""}${speciesLabel} · ${fmt(r.bodyWeightKg, 2)} kg`],
    [pt(lang, "life_stage"),
      `${lifeStageLabel(r.species, r.lifeStageKey, lang)} (× ${fmt(r.lifeStageFactor, 2)})`],
    [pt(lang, "total_grams"), `${fmt(macros.totalGrams)} g`],
    [pt(lang, "total_kcal"), `${fmt(macros.totalKcal)} kcal`],
    [pt(lang, "energy_density"), `${fmt(macros.energyDensity_kcal_per_g, 2)} kcal/g`],
    [pt(lang, "daily_kcal_target"), `${fmt(der.derKcal)} kcal`],
    [pt(lang, "daily_feeding"), `${fmt(der.feedingGrams)} g`],
  ];
  if (r.updatedAt) rows.push([pt(lang, "saved_at"), r.updatedAt.toISOString().slice(0, 10)]);

  const colW = pageWidth(doc) / 2;
  const cellH = 26; // each row uses 26pt of vertical space
  const startY = doc.y;
  let row = 0;
  for (let i = 0; i < rows.length; i++) {
    const col = i % 2;
    const rowIdx = Math.floor(i / 2);
    const x = PAGE_MARGIN + col * colW;
    const y = startY + rowIdx * cellH;
    doc.font("RegularFont").fontSize(8).fillColor(COLOR.muted)
      .text(rows[i][0], x, y, { width: colW - 8, lineBreak: false });
    doc.font("BoldFont").fontSize(10).fillColor(COLOR.text)
      .text(rows[i][1], x, y + 11, { width: colW - 8, lineBreak: false, ellipsis: true });
    row = rowIdx;
  }
  resetCursor(doc, startY + (row + 1) * cellH + 6);
}

function drawRecipeTable(doc: PDFKit.PDFDocument, lang: PdfLang, input: GeneratePdfInput,
  _totals: NutrientTotals, macros: RecipeMacros) {
  drawSectionTitle(doc, pt(lang, "current_recipe_title"));

  const items = [...input.recipe.items]
    .map(it => {
      const ing = INGREDIENT_BY_ID[it.ingredientId];
      const pct = macros.totalGrams > 0 ? (it.grams / macros.totalGrams) * 100 : 0;
      const kcal = ing ? (ing.energy_kcal * it.grams) / 100 : 0;
      return { ing, grams: it.grams, pct, kcal, raw: it };
    })
    .sort((a, b) => b.pct - a.pct);

  const w = pageWidth(doc);
  const COL = { name: w * 0.55, grams: w * 0.13, pct: w * 0.16, kcal: w * 0.16 };
  const rowH = 16;
  const padX = 6;

  const drawHeaderRow = () => {
    ensureSpace(doc, rowH + 4);
    const y = doc.y;
    doc.rect(PAGE_MARGIN, y, w, rowH).fill(COLOR.primaryFaded);
    doc.fillColor(COLOR.primary).font("BoldFont").fontSize(8.5);
    let x = PAGE_MARGIN + padX;
    doc.text(pt(lang, "ingredient"), x, y + 4, { width: COL.name - padX * 2, lineBreak: false });
    x = PAGE_MARGIN + COL.name;
    doc.text(pt(lang, "grams_col"), x, y + 4, { width: COL.grams - padX, align: "right", lineBreak: false });
    x += COL.grams;
    doc.text(pt(lang, "pct_col"), x, y + 4, { width: COL.pct - padX, align: "right", lineBreak: false });
    x += COL.pct;
    doc.text(pt(lang, "kcal_col"), x, y + 4, { width: COL.kcal - padX, align: "right", lineBreak: false });
    resetCursor(doc, y + rowH);
  };
  drawHeaderRow();

  if (items.length === 0) {
    doc.font("RegularFont").fontSize(9).fillColor(COLOR.muted)
      .text("—", PAGE_MARGIN + padX, doc.y + 4, { width: w - padX * 2, lineBreak: false });
    resetCursor(doc, doc.y + rowH + 4);
    return;
  }

  doc.font("RegularFont").fontSize(9).fillColor(COLOR.text);
  items.forEach((it, i) => {
    if (doc.y + rowH > doc.page.height - FOOTER_RESERVE) {
      doc.addPage();
      resetCursor(doc, PAGE_MARGIN);
      drawHeaderRow();
    }
    const y = doc.y;
    if (i % 2 === 1) doc.rect(PAGE_MARGIN, y, w, rowH).fill(COLOR.zebra);
    doc.fillColor(COLOR.text).font("RegularFont").fontSize(9);
    const name = it.ing ? ingredientName(it.ing, lang) : `#${it.raw.ingredientId}`;
    let x = PAGE_MARGIN + padX;
    doc.text(name, x, y + 4, { width: COL.name - padX * 2, lineBreak: false, ellipsis: true });
    x = PAGE_MARGIN + COL.name;
    doc.text(fmt(it.grams), x, y + 4, { width: COL.grams - padX, align: "right", lineBreak: false });
    x += COL.grams;
    doc.text(`${fmt(it.pct, 1)}%`, x, y + 4, { width: COL.pct - padX, align: "right", lineBreak: false });
    x += COL.pct;
    doc.text(fmt(it.kcal), x, y + 4, { width: COL.kcal - padX, align: "right", lineBreak: false });
    resetCursor(doc, y + rowH);
  });
  // Total row
  const yT = doc.y;
  doc.moveTo(PAGE_MARGIN, yT).lineTo(PAGE_MARGIN + w, yT).strokeColor(COLOR.border).lineWidth(0.5).stroke();
  doc.font("BoldFont").fontSize(9).fillColor(COLOR.text);
  let xT = PAGE_MARGIN + padX;
  doc.text(pt(lang, "total_grams"), xT, yT + 4, { width: COL.name - padX * 2, lineBreak: false });
  xT = PAGE_MARGIN + COL.name;
  doc.text(`${fmt(macros.totalGrams)}`, xT, yT + 4, { width: COL.grams - padX, align: "right", lineBreak: false });
  xT += COL.grams;
  doc.text("100.0%", xT, yT + 4, { width: COL.pct - padX, align: "right", lineBreak: false });
  xT += COL.pct;
  doc.text(`${fmt(macros.totalKcal)}`, xT, yT + 4, { width: COL.kcal - padX, align: "right", lineBreak: false });
  resetCursor(doc, yT + rowH + 6);
}

function drawAafcoTable(doc: PDFKit.PDFDocument, lang: PdfLang, rows: AafcoRow[]) {
  drawSectionTitle(doc, pt(lang, "aafco_title"));
  doc.font("RegularFont").fontSize(8).fillColor(COLOR.muted)
    .text(pt(lang, "aafco_subtitle"), PAGE_MARGIN, doc.y, { width: pageWidth(doc), lineBreak: false });
  resetCursor(doc, doc.y + 14);

  const w = pageWidth(doc);
  const COL = { name: w * 0.36, value: w * 0.18, min: w * 0.16, max: w * 0.16, status: w * 0.14 };
  const rowH = 15;
  const padX = 6;

  const drawHeaderRow = () => {
    ensureSpace(doc, rowH);
    const y = doc.y;
    doc.rect(PAGE_MARGIN, y, w, rowH).fill(COLOR.primaryFaded);
    doc.fillColor(COLOR.primary).font("BoldFont").fontSize(8);
    let x = PAGE_MARGIN + padX;
    doc.text(pt(lang, "nutrient"), x, y + 4, { width: COL.name - padX * 2, lineBreak: false });
    x = PAGE_MARGIN + COL.name;
    doc.text(pt(lang, "per_kg_dm"), x, y + 4, { width: COL.value - padX, align: "right", lineBreak: false });
    x += COL.value;
    doc.text(pt(lang, "aafco_min"), x, y + 4, { width: COL.min - padX, align: "right", lineBreak: false });
    x += COL.min;
    doc.text(pt(lang, "aafco_max"), x, y + 4, { width: COL.max - padX, align: "right", lineBreak: false });
    x += COL.max;
    doc.text(pt(lang, "status"), x, y + 4, { width: COL.status - padX, align: "center", lineBreak: false });
    resetCursor(doc, y + rowH);
  };
  drawHeaderRow();

  // Sort: failures first
  const order = { below: 0, above: 1, borderline: 2, ok: 3, no_target: 4 } as const;
  const sorted = [...rows].sort((a, b) => order[a.status] - order[b.status]);

  doc.font("RegularFont").fontSize(8.5);
  sorted.forEach((row, i) => {
    if (doc.y + rowH > doc.page.height - FOOTER_RESERVE) {
      doc.addPage();
      resetCursor(doc, PAGE_MARGIN);
      drawHeaderRow();
    }
    const y = doc.y;
    if (i % 2 === 1) doc.rect(PAGE_MARGIN, y, w, rowH).fill(COLOR.zebra);
    doc.fillColor(COLOR.text).font("RegularFont").fontSize(8.5);
    const unitShort = row.nutrient.unit.split("/")[0];
    let x = PAGE_MARGIN + padX;
    doc.text(aafcoLabel(row.nutrient, lang), x, y + 3.5, { width: COL.name - padX * 2, lineBreak: false, ellipsis: true });
    x = PAGE_MARGIN + COL.name;
    doc.text(`${fmt(row.perKgDM)} ${unitShort}`, x, y + 3.5, { width: COL.value - padX, align: "right", lineBreak: false });
    x += COL.value;
    doc.text(fmtUnit(row.min, row.nutrient.unit), x, y + 3.5, { width: COL.min - padX, align: "right", lineBreak: false });
    x += COL.min;
    doc.text(fmtUnit(row.max, row.nutrient.unit), x, y + 3.5, { width: COL.max - padX, align: "right", lineBreak: false });
    x += COL.max;
    // Status pill, centered in status column
    const pillW = 44;
    const sx = x + (COL.status - pillW) / 2 - padX / 2;
    doc.save();
    doc.roundedRect(sx, y + 2.5, pillW, 11, 3).fill(statusColor(row.status));
    doc.fillColor("#ffffff").font("BoldFont").fontSize(7.5)
      .text(statusLabel(lang, row.status), sx, y + 4.5, { width: pillW, align: "center", lineBreak: false });
    doc.restore();
    resetCursor(doc, y + rowH);
  });
  resetCursor(doc, doc.y + 6);
}

function drawGapSuggestions(doc: PDFKit.PDFDocument, lang: PdfLang,
  rows: AafcoRow[], totalDM_g: number, excludeIds: number[]) {
  drawSectionTitle(doc, pt(lang, "gaps_title"));
  doc.font("RegularFont").fontSize(8).fillColor(COLOR.muted)
    .text(pt(lang, "gaps_intro"), PAGE_MARGIN, doc.y, { width: pageWidth(doc), lineBreak: true });
  resetCursor(doc, doc.y + 6);

  const suggestions = suggestRemediations(rows, totalDM_g, excludeIds);
  if (suggestions.length === 0) {
    doc.font("BoldFont").fontSize(10).fillColor(COLOR.ok)
      .text(pt(lang, "gaps_none"), PAGE_MARGIN, doc.y, { width: pageWidth(doc), lineBreak: false });
    resetCursor(doc, doc.y + 14);
    return;
  }

  const w = pageWidth(doc);
  suggestions.forEach((g) => {
    ensureSpace(doc, 56);
    // Row 1: Nutrient name + shortfall
    const y0 = doc.y;
    doc.font("BoldFont").fontSize(10).fillColor(COLOR.text)
      .text(aafcoLabel(g.row.nutrient, lang), PAGE_MARGIN, y0, { width: w * 0.5, lineBreak: false });
    const unitShort = g.row.nutrient.unit.split("/")[0];
    doc.font("RegularFont").fontSize(9).fillColor(COLOR.muted)
      .text(`${pt(lang, "gaps_shortfall")}: ${fmt(g.absoluteShortfall, 2)} ${unitShort}`,
        PAGE_MARGIN + w * 0.5, y0 + 1, { width: w * 0.5, align: "right", lineBreak: false });
    resetCursor(doc, y0 + 13);

    // Row 2: Fresh suggestions (single line)
    if (g.fresh.length > 0) {
      const yF = doc.y;
      doc.font("BoldFont").fontSize(8.5).fillColor(COLOR.primary)
        .text(`${pt(lang, "gaps_fresh_recommend")}:`, PAGE_MARGIN, yF, { width: 60, lineBreak: false });
      const freshLine = g.fresh.slice(0, 3).map(f =>
        `${ingredientName(f.ingredient, lang)} (${formatGrams(f.gramsNeeded)} ${pt(lang, "gaps_grams_suffix")})`
      ).join("   ·   ");
      doc.font("RegularFont").fontSize(8.5).fillColor(COLOR.text)
        .text(freshLine, PAGE_MARGIN + 64, yF, { width: w - 64, lineBreak: false, ellipsis: true });
      resetCursor(doc, yF + 12);
    }

    // Row 3: Additive
    if (g.additive) {
      const yA = doc.y;
      doc.font("BoldFont").fontSize(8.5).fillColor(COLOR.primary)
        .text(`${pt(lang, "gaps_additive_recommend")}:`, PAGE_MARGIN, yA, { width: 60, lineBreak: false });
      const cap = g.additive.cappedAtMax ? ` ${pt(lang, "gaps_capped_note")}` : "";
      doc.font("RegularFont").fontSize(8.5).fillColor(COLOR.text)
        .text(
          `${ingredientName(g.additive.ingredient, lang)} (${formatGrams(g.additive.gramsNeeded)} ${pt(lang, "gaps_grams_suffix")})${cap}`,
          PAGE_MARGIN + 64, yA, { width: w - 64, lineBreak: false, ellipsis: true });
      resetCursor(doc, yA + 12);
    }
    resetCursor(doc, doc.y + 4);
  });
}

function drawFooter(doc: PDFKit.PDFDocument, lang: PdfLang) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - 28;
    doc.font("RegularFont").fontSize(7).fillColor(COLOR.muted)
      .text(pt(lang, "footer_disclaimer"),
        PAGE_MARGIN, y, {
          width: doc.page.width - PAGE_MARGIN * 2 - 80,
          align: "left",
          lineBreak: false,
          ellipsis: true,
        });
    doc.text(`${pt(lang, "footer_page")} ${i + 1} / ${range.count}`,
      doc.page.width - PAGE_MARGIN - 80, y,
      { width: 80, align: "right", lineBreak: false });
  }
}

// ---- Public entry -------------------------------------------------------

export async function generateRecipePdf(input: GeneratePdfInput): Promise<Buffer> {
  const { lang, recipe } = input;
  const fonts = fontPathFor(lang);

  const items = recipe.items.filter(it => INGREDIENT_BY_ID[it.ingredientId]);
  const totals = recipeTotals(items);
  const macros = recipeMacros(items, totals);
  const aafcoRows = aafcoComparison(
    totals,
    macros,
    recipe.species,
    isGrowthLifeStage(recipe.species, recipe.lifeStageKey),
  );

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: PAGE_MARGIN, bottom: FOOTER_RESERVE, left: PAGE_MARGIN, right: PAGE_MARGIN },
    bufferPages: true,
  });

  doc.registerFont("RegularFont", fonts.regular);
  doc.registerFont("BoldFont", fonts.bold);
  doc.font("RegularFont");

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  drawHeader(doc, lang);
  drawSummary(doc, lang, input, totals, macros);
  drawRecipeTable(doc, lang, input, totals, macros);
  drawAafcoTable(doc, lang, aafcoRows);
  drawGapSuggestions(doc, lang, aafcoRows, macros.totalDryMatter_g, items.map(i => i.ingredientId));
  drawFooter(doc, lang);

  doc.end();
  return done;
}

void AAFCO_DOG; void AAFCO_CAT;
