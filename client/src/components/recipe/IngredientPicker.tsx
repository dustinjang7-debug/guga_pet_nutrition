import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ingredientName, type Lang, t } from "@/lib/i18n";
import type { Ingredient } from "@shared/ingredients";
import { INGREDIENTS } from "@shared/ingredients";
import { ArrowDown, ArrowUp, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

const SORTABLE_NUTRIENTS: { key: keyof Ingredient | "name"; label_en: string; label_zh: string; label_th: string; unit?: string }[] = [
  { key: "name", label_en: "Name (A–Z)", label_zh: "名称 A–Z", label_th: "ชื่อ ก–ฮ" },
  { key: "energy_kcal", label_en: "Calories", label_zh: "热量", label_th: "แคลอรี", unit: "kcal" },
  { key: "protein_g", label_en: "Protein", label_zh: "蛋白质", label_th: "โปรตีน", unit: "g" },
  { key: "fat_g", label_en: "Fat", label_zh: "脂肪", label_th: "ไขมัน", unit: "g" },
  { key: "carb_g", label_en: "Carbs", label_zh: "碳水", label_th: "คาร์บ", unit: "g" },
  { key: "fiber_g", label_en: "Fiber", label_zh: "纤维", label_th: "ใยอาหาร", unit: "g" },
  { key: "vit_a_re_ug", label_en: "Vitamin A", label_zh: "维生素A", label_th: "วิตามินเอ", unit: "μg" },
  { key: "vit_b1_mg", label_en: "Vit B1", label_zh: "维生素B1", label_th: "วิตามินบี1", unit: "mg" },
  { key: "vit_b2_mg", label_en: "Vit B2", label_zh: "维生素B2", label_th: "วิตามินบี2", unit: "mg" },
  { key: "niacin_mg", label_en: "Niacin (B3)", label_zh: "维生素B3", label_th: "วิตามินบี3", unit: "mg" },
  { key: "vit_b5_mg", label_en: "Vit B5", label_zh: "维生素B5", label_th: "วิตามินบี5", unit: "mg" },
  { key: "vit_b6_mg", label_en: "Vit B6", label_zh: "维生素B6", label_th: "วิตามินบี6", unit: "mg" },
  { key: "folate_mg", label_en: "Folate", label_zh: "叶酸", label_th: "โฟเลต", unit: "mg" },
  { key: "vit_b12_mg", label_en: "Vit B12", label_zh: "维生素B12", label_th: "วิตามินบี12", unit: "μg" },
  { key: "choline_mg", label_en: "Choline", label_zh: "胆碱", label_th: "โคลีน", unit: "mg" },
  { key: "vit_c_mg", label_en: "Vit C", label_zh: "维生素C", label_th: "วิตามินซี", unit: "mg" },
  { key: "vit_d_ug", label_en: "Vit D", label_zh: "维生素D", label_th: "วิตามินดี", unit: "μg" },
  { key: "vit_e_mg", label_en: "Vit E", label_zh: "维生素E", label_th: "วิตามินอี", unit: "mg" },
  { key: "calcium_mg", label_en: "Calcium", label_zh: "钙", label_th: "แคลเซียม", unit: "mg" },
  { key: "phosphorus_mg", label_en: "Phosphorus", label_zh: "磷", label_th: "ฟอสฟอรัส", unit: "mg" },
  { key: "potassium_mg", label_en: "Potassium", label_zh: "钾", label_th: "โพแทสเซียม", unit: "mg" },
  { key: "sodium_mg", label_en: "Sodium", label_zh: "钠", label_th: "โซเดียม", unit: "mg" },
  { key: "magnesium_mg", label_en: "Magnesium", label_zh: "镁", label_th: "แมกนีเซียม", unit: "mg" },
  { key: "iron_mg", label_en: "Iron", label_zh: "铁", label_th: "ธาตุเหล็ก", unit: "mg" },
  { key: "zinc_mg", label_en: "Zinc", label_zh: "锌", label_th: "สังกะสี", unit: "mg" },
  { key: "selenium_ug", label_en: "Selenium", label_zh: "硒", label_th: "ซีลีเนียม", unit: "μg" },
  { key: "copper_mg", label_en: "Copper", label_zh: "铜", label_th: "ทองแดง", unit: "mg" },
  { key: "manganese_mg", label_en: "Manganese", label_zh: "锰", label_th: "แมงกานีส", unit: "mg" },
];

export function IngredientPicker({
  onPick,
  lang,
  presetSort,
  excludeIds,
}: {
  onPick: (ingredient: Ingredient, defaultGrams: number) => void;
  lang: Lang;
  /** When the wizard wants to pre-sort by a specific nutrient. */
  presetSort?: keyof Ingredient;
  /** Hide these ingredient ids from the list (e.g. premix SKUs in PremixComposer). */
  excludeIds?: number[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sortKey, setSortKey] = useState<string>(presetSort ?? "name");
  const [sortDesc, setSortDesc] = useState(true);

  const categories = useMemo(() => {
    const set = new Set<string>();
    const exclude = new Set(excludeIds ?? []);
    INGREDIENTS.forEach((i) => {
      if (!exclude.has(i.id)) set.add(i.category);
    });
    return Array.from(set).sort();
  }, [excludeIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const exclude = new Set(excludeIds ?? []);
    let arr = INGREDIENTS.filter((i) => {
      if (exclude.has(i.id)) return false;
      if (category !== "all" && i.category !== category) return false;
      if (!q) return true;
      return (
        i.name_en.toLowerCase().includes(q) ||
        i.name_zh.toLowerCase().includes(q) ||
        i.name_th.toLowerCase().includes(q)
      );
    });

    if (sortKey === "name") {
      arr = [...arr].sort((a, b) => ingredientName(a, lang).localeCompare(ingredientName(b, lang), undefined, { numeric: true }));
      if (sortDesc) arr.reverse();
    } else {
      const k = sortKey as keyof Ingredient;
      arr = [...arr].sort((a, b) => {
        const av = (a[k] as number) ?? 0;
        const bv = (b[k] as number) ?? 0;
        return sortDesc ? bv - av : av - bv;
      });
    }
    return arr;
  }, [search, category, sortKey, sortDesc, lang, excludeIds]);

  const sortDef = SORTABLE_NUTRIENTS.find((s) => s.key === sortKey);
  const sortLabel = (s: typeof SORTABLE_NUTRIENTS[number]) =>
    lang === "zh" ? s.label_zh : lang === "th" ? s.label_th : s.label_en;

  return (
    <Card className="p-5 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <Search className="size-4 text-muted-foreground shrink-0" />
        <Input
          placeholder={t("search_placeholder", lang)}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 shadow-none bg-secondary/50 focus-visible:ring-1"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => setCategory("all")}
          className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
            category === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("category_all", lang)}
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              category === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/60">
        <span className="text-xs text-muted-foreground shrink-0">{t("rank_by", lang)}</span>
        <Select value={sortKey} onValueChange={setSortKey}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTABLE_NUTRIENTS.map((s) => (
              <SelectItem key={s.key as string} value={s.key as string}>
                {sortLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={() => setSortDesc(!sortDesc)}
          className="size-8 flex items-center justify-center rounded-md border border-input hover:bg-secondary transition-colors"
          title={sortDesc ? t("direction_desc", lang) : t("direction_asc", lang)}
        >
          {sortDesc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1">
        {filtered.map((ing) => {
          const sortValue = sortDef && sortDef.key !== "name" ? (ing[sortDef.key] as number) : null;
          return (
            <button
              key={ing.id}
              onClick={() => onPick(ing, 50)}
              className="w-full flex items-center justify-between gap-2 py-2 px-2 rounded-md hover:bg-secondary/60 transition-colors text-left group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{ingredientName(ing, lang)}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {ing.category} · {ing.name_zh}
                </div>
              </div>
              <div className="text-right shrink-0">
                {sortValue !== null ? (
                  <div data-numeric="true" className="text-xs font-medium">
                    {sortValue.toFixed(sortValue < 10 ? 2 : 1)} <span className="text-muted-foreground">{sortDef?.unit}</span>
                  </div>
                ) : (
                  <div data-numeric="true" className="text-xs text-muted-foreground">
                    {ing.energy_kcal.toFixed(0)} kcal
                  </div>
                )}
              </div>
              <Plus className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">No matches</div>
        )}
      </div>
    </Card>
  );
}
