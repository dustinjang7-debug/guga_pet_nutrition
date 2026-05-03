import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ingredientName, type Lang, t } from "@/lib/i18n";
import type { RecipeItem } from "@shared/calc";
import { INGREDIENT_BY_ID } from "@shared/ingredients";
import { gramsToPct, rebalanceByPct } from "@shared/rebalance";
import { scaleToVolume } from "@shared/scaleToVolume";
import { Lock, Maximize2, Trash2, Unlock } from "lucide-react";
import { useMemo } from "react";

/**
 * Current Recipe panel — % based, sorted high → low.
 *
 * Each row shows its share of the total recipe weight. Editing a % redistributes
 * the delta across the other unlocked rows pro-rata; locked rows hold their grams.
 * Total weight is preserved across edits — the "Total: NNNg" badge in the header
 * is informational only.
 *
 * Visual sort and the color stripe are derived state — the underlying `items`
 * array preserves insertion order so save/load is stable.
 *
 * Adding a new ingredient still happens in grams via the IngredientPicker.
 * The added grams expand the total; existing % shares shrink proportionally.
 */
export function RecipeItemsList({
  items,
  locks,
  onItemsChange,
  onToggleLock,
  onClearLocks,
  onRemove,
  lang,
}: {
  items: RecipeItem[];
  /** Set of ingredientIds that are locked. */
  locks: Set<number>;
  /** Replace the whole items array (after a rebalance). */
  onItemsChange: (next: RecipeItem[]) => void;
  /** Toggle the lock state for one ingredient. */
  onToggleLock: (ingredientId: number) => void;
  /** Clear all locks (called after Scale-to-1000g so user can keep editing). */
  onClearLocks: () => void;
  onRemove: (ingredientId: number) => void;
  lang: Lang;
}) {
  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t("recipe_empty", lang)}
      </Card>
    );
  }

  const total = items.reduce((s, i) => s + i.grams, 0);

  // Display order: highest grams first. Underlying `items` array keeps
  // insertion order so persistence stays stable.
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.grams - a.grams),
    [items],
  );

  const allLocked = items.length > 0 && items.every(i => locks.has(i.ingredientId));

  function handleScaleTo1000() {
    onItemsChange(scaleToVolume(items, 1000));
    onClearLocks();
  }

  function handlePctChange(ingredientId: number, raw: string) {
    const pct = parseFloat(raw);
    if (Number.isNaN(pct)) return;
    const annotated = items.map(i => ({
      ingredientId: i.ingredientId,
      grams: i.grams,
      locked: locks.has(i.ingredientId),
    }));
    const next = rebalanceByPct(annotated, ingredientId, pct);
    onItemsChange(next.map(({ ingredientId, grams }) => ({ ingredientId, grams })));
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-border/60">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider">
            {t("current_recipe", lang)}
          </h2>
          <span data-numeric="true" className="text-xs text-muted-foreground">
            {items.length} {t("ingredients_count", lang)} · {t("total_label", lang)} {total.toFixed(0)} g
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">{t("rebalance_hint", lang)}</p>
        {allLocked && (
          <button
            onClick={handleScaleTo1000}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title={t("scale_hint_all_locked", lang)}
          >
            <Maximize2 className="size-3" />
            {t("scale_to_1000g", lang)}
          </button>
        )}
      </div>

      <div className="divide-y divide-border/60">
        {sorted.map(item => {
          const ing = INGREDIENT_BY_ID[item.ingredientId];
          if (!ing) return null;
          const pct = gramsToPct(item.grams, total);
          const isLocked = locks.has(item.ingredientId);
          return (
            <div
              key={item.ingredientId}
              className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                isLocked ? "bg-amber-50/40" : "hover:bg-secondary/30"
              }`}
            >
              <button
                onClick={() => onToggleLock(item.ingredientId)}
                title={isLocked ? t("unlock_row", lang) : t("lock_row", lang)}
                className={`size-7 flex items-center justify-center rounded-md transition-colors shrink-0 ${
                  isLocked
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {isLocked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{ingredientName(ing, lang)}</div>
                <div data-numeric="true" className="text-[11px] text-muted-foreground">
                  {ing.category} · {item.grams.toFixed(0)} g · {((item.grams / 100) * ing.energy_kcal).toFixed(0)} kcal
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={pct.toFixed(1)}
                  data-numeric="true"
                  onChange={e => handlePctChange(item.ingredientId, e.target.value)}
                  className="w-20 h-8 text-right"
                  disabled={isLocked}
                  title={isLocked ? t("unlock_row", lang) : t("pct_of_recipe", lang)}
                />
                <span className="text-xs text-muted-foreground w-4">%</span>
                <button
                  onClick={() => onRemove(item.ingredientId)}
                  className="ml-1 size-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

