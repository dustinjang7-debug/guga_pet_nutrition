import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ingredientName, type Lang, t } from "@/lib/i18n";
import type { RecipeItem } from "@shared/calc";
import { INGREDIENT_BY_ID } from "@shared/ingredients";
import { Maximize2, Trash2 } from "lucide-react";

export function RecipeItemsList({
  items,
  onChangeGrams,
  onRemove,
  onScaleToVolume,
  startingVolume,
  lang,
}: {
  items: RecipeItem[];
  onChangeGrams: (ingredientId: number, grams: number) => void;
  onRemove: (ingredientId: number) => void;
  /** When provided, shows a "Scale to volume" button to proportionally rescale all items so total = startingVolume. */
  onScaleToVolume?: () => void;
  /** Target volume to display in the scale button label. */
  startingVolume?: number;
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
  const offTarget =
    onScaleToVolume && startingVolume && startingVolume > 0
      ? Math.abs(total - startingVolume) >= 1
      : false;

  const scaleLabel =
    lang === "zh" ? `缩放至 ${startingVolume?.toFixed(0)}g`
      : lang === "th" ? `ปรับเป็น ${startingVolume?.toFixed(0)}g`
      : `Scale to ${startingVolume?.toFixed(0)}g`;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider">
          {t("current_recipe", lang)}
        </h2>
        <div className="flex items-center gap-2">
          <span
            data-numeric="true"
            className={`text-xs ${offTarget ? "text-amber-700 font-medium" : "text-muted-foreground"}`}
          >
            {items.length} {t("ingredients_count", lang)} · {total.toFixed(0)} g
          </span>
          {onScaleToVolume && startingVolume && startingVolume > 0 && (
            <Button
              variant={offTarget ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={onScaleToVolume}
              disabled={total === 0}
              title={scaleLabel}
            >
              <Maximize2 className="size-3.5" />
              <span className="hidden sm:inline">{scaleLabel}</span>
            </Button>
          )}
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {items.map((item) => {
          const ing = INGREDIENT_BY_ID[item.ingredientId];
          if (!ing) return null;
          const pctOfTotal = total > 0 ? (item.grams / total) * 100 : 0;
          return (
            <div
              key={item.ingredientId}
              className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{ingredientName(ing, lang)}</div>
                <div data-numeric="true" className="text-[11px] text-muted-foreground">
                  {ing.category} · {pctOfTotal.toFixed(1)}% · {((item.grams / 100) * ing.energy_kcal).toFixed(0)} kcal
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={item.grams}
                  data-numeric="true"
                  onChange={(e) => onChangeGrams(item.ingredientId, parseFloat(e.target.value) || 0)}
                  className="w-20 h-8 text-right"
                />
                <span className="text-xs text-muted-foreground w-4">g</span>
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
