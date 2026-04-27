import { Card } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Lang, t } from "@/lib/i18n";
import type { AafcoRow } from "@shared/calc";

/**
 * Row-level background tint mapped to AAFCO status.
 *
 * Per user request:
 *   below      -> red     (insufficient)
 *   borderline -> green   (meets AAFCO min, within 10% — tight margin)
 *   ok         -> green   (comfortably within band)
 *   above      -> orange  (exceeds AAFCO max)
 *   no_target  -> neutral
 *
 * Tints are kept faint so the row text stays readable.
 */
function rowClass(s: AafcoRow["status"]): string {
  switch (s) {
    case "below":      return "bg-red-50/80 hover:bg-red-100/80";
    case "borderline": return "bg-emerald-50/60 hover:bg-emerald-100/80";
    case "ok":         return "bg-emerald-50/80 hover:bg-emerald-100/80";
    case "above":      return "bg-orange-50/80 hover:bg-orange-100/80";
    case "no_target":  return "hover:bg-secondary/20";
  }
}

/** Coloured left edge (4px) so colour-blind users can see status at a glance. */
function rowAccent(s: AafcoRow["status"]): string {
  switch (s) {
    case "below":      return "border-l-4 border-l-red-400";
    case "borderline": return "border-l-4 border-l-emerald-300";
    case "ok":         return "border-l-4 border-l-emerald-400";
    case "above":      return "border-l-4 border-l-orange-400";
    case "no_target":  return "border-l-4 border-l-transparent";
  }
}

function nutrientLabel(row: AafcoRow, lang: Lang) {
  if (lang === "zh") return row.nutrient.label_zh;
  if (lang === "th") return row.nutrient.label_th;
  return row.nutrient.label_en;
}

function fmt(n: number, unit: string): string {
  if (!isFinite(n)) return "—";
  if (unit.startsWith("g/")) return n < 10 ? n.toFixed(2) : n.toFixed(1);
  if (n < 1) return n.toFixed(3);
  if (n < 10) return n.toFixed(2);
  return n.toFixed(1);
}

export function AafcoPanel({
  rows,
  lang,
  basis: _basis,
  setBasis: _setBasis,
  onAutoFix,
}: {
  rows: AafcoRow[];
  lang: Lang;
  /** Kept for API compatibility; per-1000-kcal toggle removed (always shows per-kg DM). */
  basis?: "dm" | "me";
  setBasis?: (b: "dm" | "me") => void;
  /** Optional: when supplied, a small "Fix" link is rendered next to each below/borderline row. */
  onAutoFix?: (nutrientKey: string) => void;
}) {
  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status]++;
      return acc;
    },
    { below: 0, borderline: 0, ok: 0, above: 0, no_target: 0 },
  );

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider">
          {t("aafco_panel", lang)}
        </h2>
        <div className="flex items-center gap-3 text-[11px]">
          <Legend dotClass="bg-emerald-400" label={lang === "zh" ? "达标" : lang === "th" ? "ผ่าน" : "Met"}      count={counts.ok + counts.borderline} />
          <Legend dotClass="bg-red-400"     label={lang === "zh" ? "不足" : lang === "th" ? "ขาด"  : "Below"}    count={counts.below} />
          <Legend dotClass="bg-orange-400"  label={lang === "zh" ? "超标" : lang === "th" ? "เกิน" : "Over max"} count={counts.above} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-muted-foreground text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left font-medium px-5 py-2">{t("nutrient", lang)}</th>
              <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">
                {t("per_kg_dm", lang)}
              </th>
              <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">{t("aafco_min", lang)}</th>
              <th className="text-right font-medium px-3 py-2 hidden md:table-cell">{t("aafco_max", lang)}</th>
              {onAutoFix && <th className="text-right font-medium px-5 py-2 w-12">&nbsp;</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const value = row.perKgDM;
              return (
                <tr
                  key={row.nutrient.key}
                  className={`border-t border-border/40 transition-colors ${rowAccent(row.status)} ${rowClass(row.status)}`}
                >
                  <td className="px-5 py-2">
                    <div className="font-medium">{nutrientLabel(row, lang)}</div>
                    <div data-numeric="true" className="text-[10px] text-muted-foreground">{row.nutrient.unit}</div>
                  </td>
                  <td data-numeric="true" className="text-right px-3 py-2 hidden sm:table-cell tabular-nums">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{fmt(value, row.nutrient.unit)}</span>
                        </TooltipTrigger>
                        {row.delta !== 0 && (
                          <TooltipContent>
                            <span data-numeric="true" className="text-xs">
                              Δ {fmt(row.delta, row.nutrient.unit)} {row.nutrient.unit}
                            </span>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td data-numeric="true" className="text-right px-3 py-2 text-muted-foreground hidden sm:table-cell tabular-nums">
                    {row.min !== null ? fmt(row.min, row.nutrient.unit) : "—"}
                  </td>
                  <td data-numeric="true" className="text-right px-3 py-2 text-muted-foreground hidden md:table-cell tabular-nums">
                    {row.max !== null ? fmt(row.max, row.nutrient.unit) : "—"}
                  </td>
                  {onAutoFix && (
                    <td className="text-right px-5 py-2 w-12">
                      {(row.status === "below" || row.status === "above") && (
                        <button
                          onClick={() => onAutoFix(row.nutrient.key)}
                          className="text-[10px] font-medium text-primary hover:underline"
                          title={lang === "zh" ? "自动修复建议" : lang === "th" ? "คำแนะนำเสริม" : "Auto-fix"}
                        >
                          {lang === "zh" ? "修复" : lang === "th" ? "เสริม" : "Fix"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Legend({ dotClass, label, count }: { dotClass: string; label: string; count: number }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-2 rounded-full ${dotClass}`} />
      <span data-numeric="true" className="text-muted-foreground">{count}</span>
      <span className="text-muted-foreground hidden sm:inline">{label}</span>
    </span>
  );
}
