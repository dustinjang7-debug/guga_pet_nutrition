import { Card } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Lang, t } from "@/lib/i18n";
import type { AafcoRow } from "@shared/calc";

function statusClass(s: AafcoRow["status"]) {
  switch (s) {
    case "below":      return "text-[var(--status-below)] bg-[var(--status-below)]/10";
    case "borderline": return "text-[var(--status-borderline)] bg-[var(--status-borderline)]/15";
    case "ok":         return "text-[var(--status-ok)] bg-[var(--status-ok)]/10";
    case "above":      return "text-[var(--status-above)] bg-[var(--status-above)]/10";
    case "no_target":  return "text-muted-foreground bg-muted/40";
  }
}

function statusLabel(s: AafcoRow["status"], lang: Lang) {
  const map = {
    below: t("status_below", lang),
    borderline: t("status_borderline", lang),
    ok: t("status_ok", lang),
    above: t("status_above", lang),
    no_target: t("status_no_target", lang),
  };
  return map[s];
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
  basis,
  setBasis,
}: {
  rows: AafcoRow[];
  lang: Lang;
  basis: "dm" | "me";
  setBasis: (b: "dm" | "me") => void;
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
      <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider">
          {t("aafco_panel", lang)}
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-[var(--status-ok)]" />
              <span data-numeric="true" className="text-muted-foreground">{counts.ok}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-[var(--status-borderline)]" />
              <span data-numeric="true" className="text-muted-foreground">{counts.borderline}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-[var(--status-below)]" />
              <span data-numeric="true" className="text-muted-foreground">{counts.below}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-[var(--status-above)]" />
              <span data-numeric="true" className="text-muted-foreground">{counts.above}</span>
            </span>
          </div>
          <div className="flex border border-border rounded-md overflow-hidden text-[11px]">
            <button
              onClick={() => setBasis("dm")}
              className={`px-2 py-1 ${basis === "dm" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {t("per_kg_dm", lang)}
            </button>
            <button
              onClick={() => setBasis("me")}
              className={`px-2 py-1 border-l border-border ${basis === "me" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {t("per_1000_kcal", lang)}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-muted-foreground text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left font-medium px-5 py-2">{t("nutrient", lang)}</th>
              <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">
                {basis === "dm" ? t("per_kg_dm", lang) : t("per_1000_kcal", lang)}
              </th>
              <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">{t("aafco_min", lang)}</th>
              <th className="text-right font-medium px-3 py-2 hidden md:table-cell">{t("aafco_max", lang)}</th>
              <th className="text-right font-medium px-5 py-2">{t("status", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const value = basis === "dm" ? row.perKgDM : row.per1000kcal;
              return (
                <tr key={row.nutrient.key} className="border-t border-border/40 hover:bg-secondary/20">
                  <td className="px-5 py-2">
                    <div className="font-medium">{nutrientLabel(row, lang)}</div>
                    <div data-numeric="true" className="text-[10px] text-muted-foreground">{row.nutrient.unit}</div>
                  </td>
                  <td data-numeric="true" className="text-right px-3 py-2 hidden sm:table-cell">
                    {fmt(value, row.nutrient.unit)}
                  </td>
                  <td data-numeric="true" className="text-right px-3 py-2 text-muted-foreground hidden sm:table-cell">
                    {row.min !== null ? fmt(row.min, row.nutrient.unit) : "—"}
                  </td>
                  <td data-numeric="true" className="text-right px-3 py-2 text-muted-foreground hidden md:table-cell">
                    {row.max !== null ? fmt(row.max, row.nutrient.unit) : "—"}
                  </td>
                  <td className="text-right px-5 py-2">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-medium ${statusClass(row.status)}`}>
                            {statusLabel(row.status, lang)}
                          </span>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
