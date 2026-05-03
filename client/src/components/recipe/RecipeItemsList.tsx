import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ingredientName, type Lang, t } from "@/lib/i18n";
import type { RecipeItem } from "@shared/calc";
import { INGREDIENT_BY_ID } from "@shared/ingredients";
import { gramsToPct, rebalanceByPct } from "@shared/rebalance";
import { scaleToVolume } from "@shared/scaleToVolume";
import { ArrowDownWideNarrow, Lock, Maximize2, Trash2, Unlock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * Current Recipe panel — % based.
 *
 * Each row's % is a typeable input committed on blur/Enter (1-decimal max).
 * Editing a % redistributes the delta across the other unlocked/non-fixed rows
 * pro-rata; locked + fixed rows hold their grams. Total weight is preserved.
 *
 * Sort: insertion order by default. User can click "Sort by %" once to snapshot
 * a sort by largest %. The sorted snapshot is held until they click it again.
 * (We don't auto-resort during typing — that makes the row jump under the cursor.)
 */
export function RecipeItemsList({
  items,
  locks,
  onItemsChange,
  onToggleLock,
  onClearLocks,
  onRemove,
  lang,
  fixedIds,
}: {
  items: RecipeItem[];
  locks: Set<number>;
  onItemsChange: (next: RecipeItem[]) => void;
  onToggleLock: (ingredientId: number) => void;
  onClearLocks: () => void;
  onRemove: (ingredientId: number) => void;
  lang: Lang;
  /** Ingredient ids that are fixed (cannot be removed, % cannot be edited). */
  fixedIds?: number[];
}) {
  const [sortByPct, setSortByPct] = useState(false);

  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t("recipe_empty", lang)}
      </Card>
    );
  }

  const total = items.reduce((s, i) => s + i.grams, 0);

  const fixedSet = useMemo(() => new Set(fixedIds ?? []), [fixedIds]);

  // Display order: insertion order, OR sorted desc by grams when toggled.
  const display = useMemo(() => {
    if (!sortByPct) return items;
    return [...items].sort((a, b) => b.grams - a.grams);
  }, [items, sortByPct]);

  const allLocked = items.length > 0 && items.every(i => locks.has(i.ingredientId));

  function handleScaleTo1000() {
    onItemsChange(scaleToVolume(items, 1000));
    onClearLocks();
  }

  function handleCommitPct(ingredientId: number, pct: number) {
    if (Number.isNaN(pct) || pct < 0) return;
    // Round to 1 decimal so the user sees what they typed.
    const rounded = Math.round(pct * 10) / 10;
    const annotated = items.map(i => ({
      ingredientId: i.ingredientId,
      grams: i.grams,
      locked: locks.has(i.ingredientId) || fixedSet.has(i.ingredientId),
    }));
    const next = rebalanceByPct(annotated, ingredientId, rounded);
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
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSortByPct(s => !s)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
              sortByPct
                ? "bg-primary/15 text-primary hover:bg-primary/25"
                : "bg-secondary text-foreground/80 hover:bg-secondary/70"
            }`}
            title={t("sort_by_pct_hint", lang)}
          >
            <ArrowDownWideNarrow className="size-3" />
            {t("sort_by_pct", lang)}
          </button>
          {allLocked && (
            <button
              onClick={handleScaleTo1000}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              title={t("scale_hint_all_locked", lang)}
            >
              <Maximize2 className="size-3" />
              {t("scale_to_1000g", lang)}
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-border/60">
        {display.map(item => {
          const ing = INGREDIENT_BY_ID[item.ingredientId];
          if (!ing) return null;
          const pct = gramsToPct(item.grams, total);
          const isFixed = fixedSet.has(item.ingredientId);
          const isLocked = locks.has(item.ingredientId) || isFixed;
          return (
            <div
              key={item.ingredientId}
              className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                isFixed
                  ? "bg-primary/5 border-l-2 border-primary"
                  : isLocked
                    ? "bg-amber-50/40"
                    : "hover:bg-secondary/30"
              }`}
            >
              {isFixed ? (
                <span
                  className="size-7 flex items-center justify-center rounded-md bg-primary/15 text-primary shrink-0"
                  title={t("premix_locked_hint", lang)}
                >
                  <Lock className="size-3.5" />
                </span>
              ) : (
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
              )}

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{ingredientName(ing, lang)}</div>
                <div data-numeric="true" className="text-[11px] text-muted-foreground">
                  {ing.category} · {item.grams.toFixed(0)} g · {((item.grams / 100) * ing.energy_kcal).toFixed(0)} kcal
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <PctInput
                  pct={pct}
                  disabled={isLocked}
                  onCommit={(next) => handleCommitPct(item.ingredientId, next)}
                  title={
                    isFixed
                      ? t("premix_locked_hint", lang)
                      : isLocked
                        ? t("unlock_row", lang)
                        : t("pct_of_recipe", lang)
                  }
                />
                <span className="text-xs text-muted-foreground w-4">%</span>
                {!isFixed && (
                  <button
                    onClick={() => onRemove(item.ingredientId)}
                    className="ml-1 size-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * Typeable % input. Tracks a local draft string while the user is editing.
 * Commits on blur or Enter; reverts on Escape. Round-trips to 1 decimal.
 */
function PctInput({
  pct,
  disabled,
  onCommit,
  title,
}: {
  pct: number;
  disabled: boolean;
  onCommit: (pct: number) => void;
  title: string;
}) {
  const formatted = pct.toFixed(1);
  const [draft, setDraft] = useState(formatted);
  const [editing, setEditing] = useState(false);

  // When the canonical pct changes from outside (e.g. another row was edited
  // and this row's % shifted), update the draft only if the user isn't actively
  // editing this field.
  useEffect(() => {
    if (!editing) setDraft(formatted);
  }, [formatted, editing]);

  function commit() {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (Number.isNaN(parsed)) {
      setDraft(formatted);
      return;
    }
    onCommit(parsed);
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={draft}
      data-numeric="true"
      onFocus={(e) => {
        setEditing(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        // Allow only digits + one decimal separator. 1-decimal max.
        const cleaned = e.target.value.replace(/[^\d.]/g, "");
        const parts = cleaned.split(".");
        const next = parts.length > 1
          ? `${parts[0]}.${parts.slice(1).join("").slice(0, 1)}`
          : cleaned;
        setDraft(next);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setDraft(formatted);
          setEditing(false);
          e.currentTarget.blur();
        }
      }}
      className="w-20 h-8 text-right"
      disabled={disabled}
      title={title}
    />
  );
}
