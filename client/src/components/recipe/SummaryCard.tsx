import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type Lang, t } from "@/lib/i18n";
import {
  type CaPRatio,
  caPhosphorusRatio,
  type DailyFeed,
  nutrientProfile,
  type NutrientProfileRow,
  type NutrientTotals,
  type RecipeMacros,
} from "@shared/calc";
import type { Species } from "@shared/aafco";
import { ChevronRight, ChevronUp, Table as TableIcon } from "lucide-react";
import { useEffect, useState } from "react";

export function SummaryCard({
  macros,
  daily,
  totals,
  species = "dog",
  isGrowth = false,
  lang,
}: {
  macros: RecipeMacros;
  daily: DailyFeed;
  /**
   * Optional — when provided, the card shows the Ca:P ratio panel and an
   * "Open full nutrient profile" button. Older callers that only pass macros
   * still render the basic summary so existing pages stay functional.
   */
  totals?: NutrientTotals;
  species?: Species;
  isGrowth?: boolean;
  lang: Lang;
  /** When true, the card collapses to a one-line summary once a recipe has weight. */
  collapsible?: boolean;
}) {
  const ratio = totals
    ? caPhosphorusRatio(totals, species, isGrowth)
    : null;

  // Auto-collapse once a meaningful recipe exists; user can re-expand by clicking.
  const hasContent = macros.totalGrams > 0;
  const [expanded, setExpanded] = useState<boolean>(true);
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  useEffect(() => {
    if (hasContent && !autoCollapsed) {
      setExpanded(false);
      setAutoCollapsed(true);
    }
  }, [hasContent, autoCollapsed]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider">
          {t("summary", lang)}
        </h2>
        {hasContent && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((x) => !x)} className="h-7 px-2">
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            <span className="text-xs">{expanded ? (lang === "zh" ? "收起" : lang === "th" ? "⊥⊦" : "Collapse") : (lang === "zh" ? "展开" : lang === "th" ? "ขยาย" : "Expand")}</span>
          </Button>
        )}
      </div>

      {/* Collapsed: one-line summary */}
      {hasContent && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-left rounded-md border border-border/60 bg-secondary/30 hover:bg-secondary/50 px-3 py-2 transition-colors text-sm text-muted-foreground"
        >
          <span data-numeric="true" className="text-foreground font-medium">{macros.totalGrams.toFixed(0)}</span> g
          {" · "}
          <span data-numeric="true" className="text-foreground font-medium">{macros.totalKcal.toFixed(0)}</span> kcal
          {" · "}
          <span data-numeric="true" className="text-foreground">{daily.feedingGrams.toFixed(0)}</span> g/day
          {ratio && ratio.ratio !== null && (
            <span className="ml-2">· Ca:P <span data-numeric="true" className="text-foreground">{ratio.ratio.toFixed(2)}</span></span>
          )}
        </button>
      )}

      {expanded && (<>

      <div className="grid grid-cols-2 gap-3">
        <Metric label={t("total_grams", lang)} value={`${macros.totalGrams.toFixed(0)} g`} />
        <Metric label={t("total_kcal", lang)} value={`${macros.totalKcal.toFixed(0)} kcal`} />
        <Metric label={t("energy_density", lang)} value={`${macros.energyDensity_kcal_per_g.toFixed(2)} kcal/g`} />
        <Metric label={t("moisture", lang)} value={`${macros.moisturePct.toFixed(1)}%`} />
      </div>

      <div className="pt-3 border-t border-border/60 grid grid-cols-2 gap-3">
        <Metric label={t("daily_kcal_target", lang)} value={`${daily.derKcal.toFixed(0)} kcal`} accent />
        <Metric label={t("daily_feeding", lang)} value={`${daily.feedingGrams.toFixed(0)} g`} accent />
      </div>

      <div className="pt-3 border-t border-border/60 grid grid-cols-2 gap-3">
        <Metric label={t("water_from_food", lang)} value={`${daily.waterFromFood_mL.toFixed(0)} mL`} />
        <Metric label={t("water_still_needed", lang)} value={`${daily.waterStillNeeded_mL.toFixed(0)} mL`} />
      </div>

      {ratio && totals && (
        <>
          <CaPRatioPanel ratio={ratio} lang={lang} />
          <FullProfileButton totals={totals} macros={macros} lang={lang} />
        </>
      )}
      </>)}
    </Card>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div data-numeric="true" className={`text-lg ${accent ? "text-primary font-semibold" : "font-medium"} mt-0.5`}>
        {value}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Ca:P ratio panel
// ----------------------------------------------------------------------------

function CaPRatioPanel({ ratio, lang }: { ratio: CaPRatio; lang: Lang }) {
  const label =
    lang === "zh" ? "钙磷比" : lang === "th" ? "อัตราส่วนแคลเซียม:ฟอสฟอรัส" : "Ca : P ratio";
  const golden =
    lang === "zh" ? `理想 ${ratio.goldenMin}–${ratio.goldenMax}:1` :
    lang === "th" ? `เหมาะสม ${ratio.goldenMin}–${ratio.goldenMax}:1` :
    `Golden ${ratio.goldenMin}–${ratio.goldenMax} : 1`;
  const aafco = `AAFCO ${ratio.aafcoMin}–${ratio.aafcoMax} : 1`;

  let statusColor = "bg-secondary text-foreground";
  let statusText: string;
  if (ratio.status === "empty") {
    statusColor = "bg-secondary text-muted-foreground";
    statusText = lang === "zh" ? "等待数据" : lang === "th" ? "รอข้อมูล" : "Waiting on data";
  } else if (ratio.status === "golden") {
    statusColor = "bg-emerald-100 text-emerald-700";
    statusText = lang === "zh" ? "完美" : lang === "th" ? "เหมาะสมที่สุด" : "Golden";
  } else if (ratio.status === "ok") {
    statusColor = "bg-amber-100 text-amber-700";
    statusText = lang === "zh" ? "可接受" : lang === "th" ? "ยอมรับได้" : "Acceptable";
  } else if (ratio.status === "low") {
    statusColor = "bg-red-100 text-red-700";
    statusText = lang === "zh" ? "钙不足" : lang === "th" ? "ขาดแคลเซียม" : "Low Ca";
  } else {
    statusColor = "bg-red-100 text-red-700";
    statusText = lang === "zh" ? "钙过多" : lang === "th" ? "แคลเซียมมากเกินไป" : "High Ca";
  }

  return (
    <div className="pt-3 border-t border-border/60 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor}`}>
          {statusText}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span data-numeric="true" className="text-2xl font-semibold">
          {ratio.status === "empty" ? "—" : ratio.ratio.toFixed(2)}
        </span>
        <span className="text-sm text-muted-foreground">: 1</span>
      </div>
      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <div>{golden}</div>
        <div>{aafco}</div>
        <div data-numeric="true">
          Ca {ratio.calcium_mg.toFixed(0)} mg · P {ratio.phosphorus_mg.toFixed(0)} mg
        </div>
      </div>
      <CaPRatioBar ratio={ratio} />
    </div>
  );
}

/**
 * Visual bar: AAFCO range as track, golden range as inner darker band,
 * current ratio as a marker. Helps users see at a glance where the recipe
 * sits relative to both bands.
 */
function CaPRatioBar({ ratio }: { ratio: CaPRatio }) {
  if (ratio.status === "empty") return null;
  const barMin = 0.5;
  const barMax = Math.max(2.5, ratio.aafcoMax + 0.2, ratio.ratio + 0.2);
  const range = barMax - barMin;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - barMin) / range) * 100));

  return (
    <div className="relative h-2 rounded-full bg-secondary mt-1">
      {/* AAFCO band */}
      <div
        className="absolute h-2 rounded-full bg-amber-200"
        style={{ left: `${pct(ratio.aafcoMin)}%`, width: `${pct(ratio.aafcoMax) - pct(ratio.aafcoMin)}%` }}
      />
      {/* Golden band */}
      <div
        className="absolute h-2 rounded-full bg-emerald-300"
        style={{ left: `${pct(ratio.goldenMin)}%`, width: `${pct(ratio.goldenMax) - pct(ratio.goldenMin)}%` }}
      />
      {/* Marker */}
      <div
        className="absolute -top-0.5 size-3 rounded-full border-2 border-foreground bg-background"
        style={{ left: `calc(${pct(ratio.ratio)}% - 6px)` }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Full nutrient profile dialog
// ----------------------------------------------------------------------------

function FullProfileButton({
  totals,
  macros,
  lang,
}: {
  totals: NutrientTotals;
  macros: RecipeMacros;
  lang: Lang;
}) {
  const [open, setOpen] = useState(false);
  const rows = nutrientProfile(totals, macros);
  const label =
    lang === "zh" ? "查看完整营养成分" :
    lang === "th" ? "ดูโปรไฟล์สารอาหารทั้งหมด" :
    "View full nutrient profile";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between mt-2">
          <span className="inline-flex items-center gap-2">
            <TableIcon className="size-3.5" />
            {label}
          </span>
          <ChevronRight className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {lang === "zh" ? "完整营养成分" : lang === "th" ? "โปรไฟล์สารอาหารฉบับเต็ม" : "Full nutrient profile"}
          </DialogTitle>
          <DialogDescription>
            {lang === "zh" ?
              "总值 · 每千克干物质" :
              lang === "th" ?
              "ค่ารวม · ต่อกิโลกรัมวัตถุแห้ง" :
              "Total · per kg dry matter"}
          </DialogDescription>
        </DialogHeader>
        <NutrientTable rows={rows} lang={lang} />
      </DialogContent>
    </Dialog>
  );
}

function NutrientTable({ rows, lang }: { rows: NutrientProfileRow[]; lang: Lang }) {
  // Group rows visually
  const groups: Record<string, { title: string; rows: NutrientProfileRow[] }> = {
    macro:       { title: lang === "zh" ? "宏量营养素" : lang === "th" ? "สารอาหารหลัก" : "Macronutrients",       rows: [] },
    energy:      { title: lang === "zh" ? "能量"       : lang === "th" ? "พลังงาน"       : "Energy",                rows: [] },
    fiber_other: { title: lang === "zh" ? "其他"       : lang === "th" ? "อื่น ๆ"        : "Other",                 rows: [] },
    vitamin:     { title: lang === "zh" ? "维生素"     : lang === "th" ? "วิตามิน"       : "Vitamins",              rows: [] },
    mineral:     { title: lang === "zh" ? "矿物质"     : lang === "th" ? "แร่ธาตุ"       : "Minerals",              rows: [] },
  };
  rows.forEach((r) => groups[r.group]?.rows.push(r));

  const headers = {
    nutrient:    lang === "zh" ? "营养素"        : lang === "th" ? "สารอาหาร"     : "Nutrient",
    total:       lang === "zh" ? "总量"          : lang === "th" ? "รวม"           : "Total",
    perKgDM:     lang === "zh" ? "每千克干物质"  : lang === "th" ? "ต่อ kg DM"     : "per kg DM",
  };

  return (
    <ScrollArea className="h-[60vh] rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card z-10">
          <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="text-left px-3 py-2">{headers.nutrient}</th>
            <th className="text-right px-3 py-2">{headers.total}</th>
            <th className="text-right px-3 py-2">{headers.perKgDM}</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groups).map(([gkey, g]) =>
            g.rows.length === 0 ? null : (
              <GroupRows key={gkey} title={g.title} rows={g.rows} lang={lang} />
            ),
          )}
        </tbody>
      </table>
    </ScrollArea>
  );
}

function GroupRows({
  title,
  rows,
  lang,
}: {
  title: string;
  rows: NutrientProfileRow[];
  lang: Lang;
}) {
  return (
    <>
      <tr className="bg-secondary/40 sticky">
        <td colSpan={3} className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {title}
        </td>
      </tr>
      {rows.map((r) => {
        const label =
          lang === "zh" ? r.label_zh : lang === "th" ? r.label_th : r.label_en;
        return (
          <tr key={r.key} className="border-b border-border/60 last:border-0">
            <td className="px-3 py-2">
              <div className="font-medium">{label}</div>
              <div className="text-[10px] text-muted-foreground uppercase">{r.unit}</div>
            </td>
            <td data-numeric="true" className="text-right px-3 py-2 tabular-nums">{fmt(r.total)}</td>
            <td data-numeric="true" className="text-right px-3 py-2 tabular-nums text-muted-foreground">{fmt(r.perKgDM)}</td>
          </tr>
        );
      })}
    </>
  );
}

function fmt(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "0";
  if (v >= 1000) return v.toFixed(0);
  if (v >= 100) return v.toFixed(1);
  if (v >= 10) return v.toFixed(2);
  return v.toFixed(3);
}
