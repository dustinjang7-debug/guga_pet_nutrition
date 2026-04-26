import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Lang, t } from "@/lib/i18n";
import { MACRO_BENCHMARKS, type Species } from "@shared/aafco";

export interface MacroTargets {
  proteinPct: number;
  carbPct: number;
}

export function VolumeAndTargets({
  startingVolume,
  setStartingVolume,
  used,
  targets,
  setTargets,
  species,
  feedingMode,
  lang,
  currentMacros,
}: {
  startingVolume: number;
  setStartingVolume: (v: number) => void;
  used: number;
  targets: MacroTargets;
  setTargets: (v: MacroTargets) => void;
  species: Species;
  feedingMode: "normal" | "weight_loss";
  lang: Lang;
  currentMacros: { proteinPct_DM: number; fatPct_DM: number; carbPct_DM: number };
}) {
  const remaining = startingVolume - used;
  const percentUsed = startingVolume > 0 ? Math.min((used / startingVolume) * 100, 100) : 0;
  const overflow = used > startingVolume;

  const fatPct = Math.max(100 - targets.proteinPct - targets.carbPct, 0);

  const benchmarks = MACRO_BENCHMARKS[species][feedingMode];

  // status helpers
  const macroStatus = (val: number, b: typeof benchmarks.protein) => {
    if (val >= b.optimum[0] && val <= b.optimum[1]) return "optimum";
    if (val >= b.acceptable[0] && val <= b.acceptable[1]) return "acceptable";
    return "out";
  };

  const proteinStatus = macroStatus(currentMacros.proteinPct_DM, benchmarks.protein);
  const fatStatus = macroStatus(currentMacros.fatPct_DM, benchmarks.fat);
  const carbStatus = macroStatus(currentMacros.carbPct_DM, benchmarks.carb);

  const statusBadge = (s: "optimum" | "acceptable" | "out") => {
    const cls =
      s === "optimum" ? "bg-[var(--status-ok)]/10 text-[var(--status-ok)]"
      : s === "acceptable" ? "bg-[var(--status-borderline)]/15 text-[var(--status-borderline)]"
      : "bg-[var(--status-below)]/10 text-[var(--status-below)]";
    const label =
      s === "optimum" ? t("macro_status_optimum", lang)
      : s === "acceptable" ? t("macro_status_acceptable", lang)
      : t("macro_status_out_of_range", lang);
    return (
      <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${cls}`}>
        {label}
      </span>
    );
  };

  return (
    <Card className="p-5 space-y-5">
      {/* Volume tracker */}
      <div>
        <div className="flex items-end justify-between mb-2">
          <Label className="text-xs text-muted-foreground">{t("starting_volume", lang)}</Label>
          {overflow && (
            <span className="text-[10px] uppercase tracking-wider text-destructive font-medium">
              {t("over_volume", lang)}
            </span>
          )}
        </div>
        <Input
          type="number"
          min={1}
          step={50}
          data-numeric="true"
          value={startingVolume}
          onChange={(e) => setStartingVolume(parseFloat(e.target.value) || 0)}
          className="mb-3"
        />
        <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 ${overflow ? "bg-destructive" : "bg-primary"} transition-all`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs">
          <span className="text-muted-foreground">
            {t("used", lang)}: <span data-numeric="true" className="text-foreground font-medium">{used.toFixed(0)}g</span>
          </span>
          <span className={`${overflow ? "text-destructive" : "text-muted-foreground"}`}>
            {t("remaining", lang)}: <span data-numeric="true" className="font-medium">{remaining.toFixed(0)}g</span>
          </span>
        </div>
      </div>

      {/* Target macros */}
      <div className="pt-3 border-t border-border/60">
        <div className="text-xs text-muted-foreground mb-3">{t("target_macros", lang)}</div>
        <div className="grid grid-cols-3 gap-2">
          <MacroBox
            label={t("target_protein", lang)}
            value={targets.proteinPct}
            current={currentMacros.proteinPct_DM}
            onChange={(v) => setTargets({ ...targets, proteinPct: v })}
            range={`${benchmarks.protein.optimum[0]}–${benchmarks.protein.optimum[1]}%`}
            badge={statusBadge(proteinStatus)}
          />
          <MacroBox
            label={t("target_carb", lang)}
            value={targets.carbPct}
            current={currentMacros.carbPct_DM}
            onChange={(v) => setTargets({ ...targets, carbPct: v })}
            range={`${benchmarks.carb.optimum[0]}–${benchmarks.carb.optimum[1]}%`}
            badge={statusBadge(carbStatus)}
          />
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <Label className="text-xs text-muted-foreground">{t("target_fat_calc", lang)}</Label>
              {statusBadge(fatStatus)}
            </div>
            <div data-numeric="true" className="rounded-md border border-input bg-muted/40 px-3 py-1.5 text-sm">
              {fatPct.toFixed(1)}%
            </div>
            <div data-numeric="true" className="text-[10px] text-muted-foreground mt-1">
              opt {benchmarks.fat.optimum[0]}–{benchmarks.fat.optimum[1]}%
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MacroBox({
  label, value, current, onChange, range, badge,
}: {
  label: string;
  value: number;
  current: number;
  onChange: (v: number) => void;
  range: string;
  badge: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {badge}
      </div>
      <Input
        type="number"
        min={0}
        max={100}
        step={1}
        data-numeric="true"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
      <div data-numeric="true" className="text-[10px] text-muted-foreground mt-1">
        opt {range} · now {current.toFixed(1)}%
      </div>
    </div>
  );
}
