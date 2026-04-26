import { Card } from "@/components/ui/card";
import { type Lang, t } from "@/lib/i18n";
import type { DailyFeed, RecipeMacros } from "@shared/calc";

export function SummaryCard({
  macros,
  daily,
  lang,
}: {
  macros: RecipeMacros;
  daily: DailyFeed;
  lang: Lang;
}) {
  return (
    <Card className="p-5 space-y-4">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider">{t("summary", lang)}</h2>

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
