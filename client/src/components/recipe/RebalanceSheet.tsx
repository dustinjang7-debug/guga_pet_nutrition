/**
 * Macro Rebalance Sheet
 *
 * Lets users specify P/F/C % targets and lock specific ingredients,
 * then runs the bounded coordinate-descent solver and previews the
 * resulting grams. "Apply" overwrites the parent's items state.
 *
 * Only available on saved Wizard / Simple Composer recipes (parent
 * gates this via `isEditing` and routes other than /premix/*).
 */
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Lock, Unlock, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang, t, ingredientName, type Lang } from "@/lib/i18n";
import { type RecipeItem, recipeTotals, recipeMacros } from "@shared/calc";
import { INGREDIENT_BY_ID } from "@shared/ingredients";
import {
  solveRebalance,
  type RebalanceResult,
  type MacroTargetsDM,
} from "@shared/macroSolver";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: RecipeItem[];
  /** Called when user clicks Apply. Parent overwrites its items state. */
  onApply: (newItems: RecipeItem[]) => void;
}

export function RebalanceSheet({ open, onOpenChange, items, onApply }: Props) {
  const [lang] = useLang();
  const baseline = useMemo(() => {
    const totals = recipeTotals(items);
    const m = recipeMacros(items, totals);
    return { P: m.proteinPct_DM, F: m.fatPct_DM, C: m.carbPct_DM };
  }, [items]);

  // Targets default to current macros so user starts from where they are.
  // Reseed whenever the modal opens with a new baseline (different recipe).
  const [targetP, setTargetP] = useState<string>(baseline.P.toFixed(1));
  const [targetF, setTargetF] = useState<string>(baseline.F.toFixed(1));
  const [targetC, setTargetC] = useState<string>(baseline.C.toFixed(1));
  const [lockedIds, setLockedIds] = useState<Set<number>>(new Set());
  const [solving, setSolving] = useState(false);
  const [result, setResult] = useState<RebalanceResult | null>(null);
  useEffect(() => {
    if (open) {
      setTargetP(baseline.P.toFixed(1));
      setTargetF(baseline.F.toFixed(1));
      setTargetC(baseline.C.toFixed(1));
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset when modal opens with a different recipe.
  // (We deliberately keep targets across re-opens of the same recipe.)
  function toggleLock(id: number) {
    const next = new Set(lockedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setLockedIds(next);
    setResult(null); // invalidate stale solution
  }

  function runSolver() {
    setSolving(true);
    // Defer to next tick so spinner paints before the solver hogs the thread.
    setTimeout(() => {
      const targets: MacroTargetsDM = {
        proteinPct: parseFloat(targetP),
        fatPct: parseFloat(targetF),
        carbPct: parseFloat(targetC),
      };
      const r = solveRebalance(items, lockedIds, targets);
      setResult(r);
      setSolving(false);
    }, 16);
  }

  function apply() {
    if (!result) return;
    onApply(result.items);
    onOpenChange(false);
    setResult(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            {t("rebalance_title", lang)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t("rebalance_help", lang)}
          </p>

          {/* Target inputs */}
          <div className="grid grid-cols-3 gap-3">
            <TargetInput label={t("target_protein", lang) + " %"} value={targetP} onChange={setTargetP} baseline={baseline.P} />
            <TargetInput label={t("target_fat", lang) + " %"} value={targetF} onChange={setTargetF} baseline={baseline.F} />
            <TargetInput label={t("target_carb", lang) + " %"} value={targetC} onChange={setTargetC} baseline={baseline.C} />
          </div>

          {/* Lock toggles per ingredient */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("rebalance_locks", lang)}
            </Label>
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto rounded-md border border-border p-2">
              {items.map(it => {
                const ing = INGREDIENT_BY_ID[it.ingredientId];
                if (!ing) return null;
                const locked = lockedIds.has(it.ingredientId);
                return (
                  <button
                    key={it.ingredientId}
                    type="button"
                    onClick={() => toggleLock(it.ingredientId)}
                    className={`w-full flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors ${
                      locked ? "bg-muted/30" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {locked ? <Lock className="size-3 shrink-0" /> : <Unlock className="size-3 shrink-0 text-muted-foreground/50" />}
                      <span className="truncate">{ingredientName(ing, lang)}</span>
                    </span>
                    <span className="text-muted-foreground tabular-nums shrink-0">{it.grams.toFixed(1)} g</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {t("rebalance_lock_hint", lang)}
            </p>
          </div>

          {/* Solve button */}
          <Button
            onClick={runSolver}
            disabled={solving || items.length === 0 || lockedIds.size === items.length}
            className="w-full"
          >
            {solving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {t("rebalance_solve", lang)}
          </Button>

          {/* Preview */}
          {result && <ResultPreview result={result} lang={lang} items={items} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel", lang)}
          </Button>
          <Button
            onClick={apply}
            disabled={!result || result.status === "all_locked" || result.status === "no_unlocked_macro_source"}
          >
            {t("rebalance_apply", lang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TargetInput({
  label, value, onChange, baseline,
}: {
  label: string; value: string; onChange: (v: string) => void; baseline: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step="0.5"
        min="0"
        max="100"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="font-mono"
      />
      <div className="text-[10px] text-muted-foreground">
        now {baseline.toFixed(1)}
      </div>
    </div>
  );
}

function ResultPreview({
  result, lang, items,
}: { result: RebalanceResult; lang: Lang; items: RecipeItem[] }) {
  const beforeById = new Map(items.map(i => [i.ingredientId, i.grams]));
  const statusColor =
    result.status === "solved" ? "text-emerald-600 dark:text-emerald-400"
    : result.status === "partial" ? "text-amber-600 dark:text-amber-400"
    : "text-destructive";
  return (
    <div className="rounded-md border border-border p-3 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{t("rebalance_result", lang)}</span>
        <span className={`uppercase tracking-wider text-[10px] font-bold ${statusColor}`}>
          {t(`rebalance_status_${result.status}` as never, lang)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <AchievedCell label={t("target_protein", lang)} value={result.achieved.proteinPct} delta={result.delta.proteinPct} />
        <AchievedCell label={t("target_fat", lang)} value={result.achieved.fatPct} delta={result.delta.fatPct} />
        <AchievedCell label={t("target_carb", lang)} value={result.achieved.carbPct} delta={result.delta.carbPct} />
      </div>
      <div className="space-y-0.5 max-h-40 overflow-y-auto">
        {result.items.map(it => {
          const ing = INGREDIENT_BY_ID[it.ingredientId];
          if (!ing) return null;
          const before = beforeById.get(it.ingredientId) ?? 0;
          const diff = it.grams - before;
          const arrow = Math.abs(diff) < 0.05 ? "·" : diff > 0 ? "↑" : "↓";
          const arrowColor =
            Math.abs(diff) < 0.05 ? "text-muted-foreground/50"
            : diff > 0 ? "text-emerald-600 dark:text-emerald-400"
            : "text-amber-600 dark:text-amber-400";
          return (
            <div key={it.ingredientId} className="flex items-center justify-between gap-2 text-xs px-1 py-0.5">
              <span className="truncate">{ingredientName(ing, lang)}</span>
              <span className="tabular-nums shrink-0">
                <span className="text-muted-foreground/70">{before.toFixed(1)}</span>
                {" → "}
                <span className="font-medium">{it.grams.toFixed(1)} g</span>
                <span className={`ml-1 ${arrowColor}`}>{arrow}{Math.abs(diff) >= 0.05 ? Math.abs(diff).toFixed(1) : ""}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AchievedCell({ label, value, delta }: { label: string; value: number; delta: number | null }) {
  const color = delta === null ? "text-muted-foreground"
    : Math.abs(delta) < 1 ? "text-emerald-600 dark:text-emerald-400"
    : Math.abs(delta) < 3 ? "text-amber-600 dark:text-amber-400"
    : "text-destructive";
  return (
    <div className="rounded bg-card p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-base tabular-nums">{value.toFixed(1)}%</div>
      {delta !== null && (
        <div className={`text-[10px] tabular-nums ${color}`}>
          {delta > 0 ? "+" : ""}{delta.toFixed(1)}
        </div>
      )}
    </div>
  );
}
