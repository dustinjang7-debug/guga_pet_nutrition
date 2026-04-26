import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ingredientName, useLang } from "@/lib/i18n";
import type { AafcoRow, RecipeItem } from "@shared/calc";
import {
  formatGrams, suggestRemediations,
} from "@shared/gapSuggester";
import { Check, FlaskConical, Leaf } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * AafcoFixSheet — slide-out panel that shows remediation suggestions for ONE
 * nutrient gap. Used by the Simple Composer (RecipeBuilder) so users can fix
 * a deficiency without leaving the page.
 */
export function AafcoFixSheet({
  open,
  onOpenChange,
  nutrientKey,
  aafco,
  items,
  totalDM_g,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  nutrientKey: string | null;
  aafco: AafcoRow[];
  items: RecipeItem[];
  totalDM_g: number;
  onAdd: (ingredientId: number, grams: number) => void;
}) {
  const [lang] = useLang();
  const [mode, setMode] = useState<"additive" | "fresh">("additive");

  const gaps = useMemo(
    () => suggestRemediations(aafco, totalDM_g, items.map((i) => i.ingredientId)),
    [aafco, totalDM_g, items],
  );
  const gap = gaps.find((g) => g.row.nutrient.key === nutrientKey);

  const titleLabel =
    gap
      ? lang === "zh" ? gap.row.nutrient.label_zh
        : lang === "th" ? gap.row.nutrient.label_th
          : gap.row.nutrient.label_en
      : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>
            {lang === "zh" ? "修复" : lang === "th" ? "เสริม" : "Fix"}: {titleLabel}
          </SheetTitle>
          <SheetDescription>
            {gap
              ? lang === "zh"
                ? `当前 ${gap.row.perKgDM.toFixed(2)} ${gap.row.nutrient.unit}，最低需 ${gap.row.min}`
                : lang === "th"
                  ? `ตอนนี้ ${gap.row.perKgDM.toFixed(2)} ${gap.row.nutrient.unit} ต้องการอย่างน้อย ${gap.row.min}`
                  : `Now ${gap.row.perKgDM.toFixed(2)} ${gap.row.nutrient.unit} · min ${gap.row.min}`
              : ""}
          </SheetDescription>
        </SheetHeader>

        {!gap ? (
          <div className="text-sm text-muted-foreground italic mt-6">
            {lang === "zh" ? "已达标,无需修复。" : lang === "th" ? "ครบถ้วนแล้ว ไม่ต้องเสริม" : "Already meets the AAFCO target."}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-1">
            <div className="flex items-center gap-1 border border-border rounded-md p-0.5 w-fit text-xs">
              <button
                onClick={() => setMode("additive")}
                className={`px-2.5 py-1 rounded ${
                  mode === "additive" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <FlaskConical className="size-3 inline-block mr-1" />
                {lang === "zh" ? "添加剂" : lang === "th" ? "สารเสริม" : "Additive"}
              </button>
              <button
                onClick={() => setMode("fresh")}
                className={`px-2.5 py-1 rounded ${
                  mode === "fresh" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <Leaf className="size-3 inline-block mr-1" />
                {lang === "zh" ? "鲜食" : lang === "th" ? "วัตถุดิบสด" : "Fresh"}
              </button>
            </div>

            {mode === "additive" && gap.additive && (
              <Card className="p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{ingredientName(gap.additive.ingredient, lang)}</div>
                  <div className="text-xs text-muted-foreground">
                    {gap.additive.densityPer100g.toFixed(0)}{" "}
                    {gap.row.nutrient.key.endsWith("_ug") ? "μg" : gap.row.nutrient.key.endsWith("_mg") ? "mg" : "g"}/100g
                    {gap.additive.cappedAtMax && (
                      <span className="ml-1 text-amber-700">
                        · {lang === "zh" ? "已达上限" : lang === "th" ? "ถึงค่าสูงสุด" : "max dose"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div data-numeric="true" className="text-base font-semibold">
                    +{formatGrams(gap.additive.gramsNeeded)} g
                  </div>
                  <Button
                    size="sm"
                    className="mt-1"
                    onClick={() => {
                      onAdd(gap.additive!.ingredient.id, parseFloat(formatGrams(gap.additive!.gramsNeeded)));
                      toast.success(`${ingredientName(gap.additive!.ingredient, lang)} +${formatGrams(gap.additive!.gramsNeeded)} g`);
                    }}
                  >
                    <Check className="size-3.5" />
                    {lang === "zh" ? "加入" : lang === "th" ? "เพิ่ม" : "Add"}
                  </Button>
                </div>
              </Card>
            )}
            {mode === "additive" && !gap.additive && (
              <p className="text-xs text-muted-foreground italic">
                {lang === "zh" ? "暂无添加剂建议,请使用鲜食材选项。" :
                  lang === "th" ? "ไม่มีสารเสริมแนะนำ ใช้วัตถุดิบสดแทน" :
                  "No additive available — use fresh option."}
              </p>
            )}

            {mode === "fresh" && (
              <div className="space-y-2">
                {gap.fresh.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    {lang === "zh" ? "数据库无足够密度的鲜食材。" :
                      lang === "th" ? "ไม่มีวัตถุดิบสดที่หนาแน่นพอ" :
                      "No dense fresh source available."}
                  </p>
                )}
                {gap.fresh.map((s) => (
                  <Card
                    key={s.ingredient.id}
                    className="p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{ingredientName(s.ingredient, lang)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {s.ingredient.category} · {s.densityPer100g.toFixed(1)}{" "}
                        {gap.row.nutrient.key.endsWith("_ug") ? "μg" : gap.row.nutrient.key.endsWith("_mg") ? "mg" : "g"}/100g
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div data-numeric="true" className="text-sm font-semibold">+{formatGrams(s.gramsNeeded)} g</div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1 h-7 text-xs px-2"
                        onClick={() => {
                          onAdd(s.ingredient.id, parseFloat(formatGrams(s.gramsNeeded)));
                          toast.success(`${ingredientName(s.ingredient, lang)} +${formatGrams(s.gramsNeeded)} g`);
                        }}
                      >
                        <Check className="size-3" />
                        {lang === "zh" ? "加入" : lang === "th" ? "เพิ่ม" : "Add"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
