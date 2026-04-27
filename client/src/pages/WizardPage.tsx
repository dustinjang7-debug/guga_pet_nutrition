import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ingredientName, t, useLang } from "@/lib/i18n";
import {
  type AafcoRow, aafcoComparison, carbKcalShare, type CarbKcalShare,
  dailyFeed, type NutrientTotals, recipeMacros, recipeTotals, type RecipeItem,
} from "@shared/calc";
import { CAT_LIFE_STAGES, DOG_LIFE_STAGES } from "@shared/aafco";
import { INGREDIENTS, INGREDIENT_BY_ID, type Ingredient } from "@shared/ingredients";
import {
  WIZARD_STEPS,
  type WizardStep,
  suggestedProteinGrams,
  suggestedCarbGrams,
} from "@shared/wizard";
import {
  suggestRemediations,
  formatGrams,
  bComplexReport,
  B_VITAMIN_KEYS,
  type BComplexReport,
} from "@shared/gapSuggester";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, FlaskConical, Leaf,
  ListChecks, Loader2, Save, Search, Sparkles, X,
} from "lucide-react";

import {
  PetProfilePane, defaultPetProfile, type PetProfileState,
} from "@/components/recipe/PetProfile";
import { SummaryCard } from "@/components/recipe/SummaryCard";
import { AafcoPanel } from "@/components/recipe/AafcoPanel";

// ============================================================================
// Types
// ============================================================================

type StepIndex = number; // 0..WIZARD_STEPS.length-1, then `complianceIndex`

const TOTAL_STEPS = WIZARD_STEPS.length + 1; // +1 for the Compliance Check
const COMPLIANCE_INDEX = WIZARD_STEPS.length;

// ============================================================================
// Page
// ============================================================================

export default function WizardPage() {
  const [lang] = useLang();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const recipeId = params.id ? parseInt(params.id, 10) : undefined;
  const isEditing = recipeId !== undefined && !isNaN(recipeId);

  // ----- State (mirrors RecipeBuilder) ---------------------------------------
  const [pet, setPet] = useState<PetProfileState>(defaultPetProfile());
  const [startingVolume, setStartingVolume] = useState(1000);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [stepIdx, setStepIdx] = useState<StepIndex>(0);
  const [recipeName, setRecipeName] = useState("");
  const [notes, setNotes] = useState("");
  const [recipeStatus, setRecipeStatus] = useState<"draft" | "approved">("draft");
  const [saveOpen, setSaveOpen] = useState(false);

  // Load existing
  const recipeQuery = trpc.recipes.get.useQuery(
    { id: recipeId! },
    { enabled: isEditing },
  );
  useEffect(() => {
    const r = recipeQuery.data;
    if (!r) return;
    setRecipeName(r.name);
    setNotes(r.notes ?? "");
    setRecipeStatus(r.status as "draft" | "approved");
    setStartingVolume(r.startingVolumeG);
    setPet({
      species: r.species as "dog" | "cat",
      bodyWeightKg: parseFloat(String(r.bodyWeightKg)),
      lifeStageKey: r.lifeStage,
      factor: parseFloat(String(r.lifeStageFactor)),
      feedingMode: r.feedingMode as "normal" | "weight_loss",
      petName: r.petName ?? "",
      petId: r.petId ?? "",
    });
    const itemsJson = r.items as unknown as { ingredientId: number; grams: number }[];
    setItems(
      (itemsJson ?? []).map((it) => ({
        ingredientId: it.ingredientId,
        grams: typeof it.grams === "string" ? parseFloat(it.grams) : it.grams,
      })),
    );
  }, [recipeQuery.data]);

  // ----- Live calculations ---------------------------------------------------
  const totals = useMemo(() => recipeTotals(items), [items]);
  const macros = useMemo(() => recipeMacros(items, totals), [items, totals]);
  const stage =
    pet.species === "dog"
      ? DOG_LIFE_STAGES[pet.lifeStageKey as keyof typeof DOG_LIFE_STAGES]
      : CAT_LIFE_STAGES[pet.lifeStageKey as keyof typeof CAT_LIFE_STAGES];
  const isGrowth = stage?.isGrowth ?? false;
  const aafco: AafcoRow[] = useMemo(
    () => aafcoComparison(totals, macros, pet.species, isGrowth),
    [totals, macros, pet.species, isGrowth],
  );
  const daily = useMemo(
    () => dailyFeed(pet.bodyWeightKg, pet.factor, macros),
    [pet.bodyWeightKg, pet.factor, macros],
  );

  // ----- Recipe mutations ----------------------------------------------------
  const utils = trpc.useUtils();
  const createMut = trpc.recipes.create.useMutation({
    onSuccess: (data) => {
      utils.recipes.list.invalidate();
      toast.success(t("save_recipe", lang) + " ✓");
      navigate(`/recipe/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.recipes.update.useMutation({
    onSuccess: () => {
      utils.recipes.list.invalidate();
      utils.recipes.get.invalidate({ id: recipeId! });
      toast.success(t("update_recipe", lang) + " ✓");
    },
    onError: (e) => toast.error(e.message),
  });
  const isSaving = createMut.isPending || updateMut.isPending;

  function commitSave() {
    if (!recipeName.trim()) {
      toast.error(t("recipe_name", lang));
      return;
    }
    const payload = {
      name: recipeName.trim(),
      notes: notes.trim(),
      status: recipeStatus,
      startingVolumeG: startingVolume,
      species: pet.species,
      bodyWeightKg: pet.bodyWeightKg,
      lifeStage: pet.lifeStageKey,
      lifeStageFactor: pet.factor,
      feedingMode: pet.feedingMode,
      workflow: "wizard" as const,
      petName: pet.petName,
      petId: pet.petId,
      items: items.map((i) => ({ ingredientId: i.ingredientId, grams: i.grams })),
    };
    if (isEditing) updateMut.mutate({ id: recipeId!, data: payload });
    else createMut.mutate(payload);
    setSaveOpen(false);
  }

  // ----- Item helpers --------------------------------------------------------
  /**
   * Upsert (set) the grams for an ingredient: if it already exists, REPLACE
   * its grams; otherwise insert. Used by the Wizard suggestion card so
   * clicking "Add to recipe" twice doesn't silently double the amount.
   */
  function upsertItem(ingredientId: number, grams: number) {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.ingredientId === ingredientId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ingredientId, grams };
        return next;
      }
      return [...prev, { ingredientId, grams }];
    });
  }

  /**
   * Increment grams for an ingredient: if it exists, ADD the new grams to its
   * current value; otherwise insert at the new amount. Used by the Compliance
   * Check “Add” action where the user explicitly wants to top up an
   * already-present ingredient (e.g. add another 5 g of eggshell powder).
   */
  function incrementItem(ingredientId: number, grams: number) {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.ingredientId === ingredientId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ingredientId, grams: prev[idx].grams + grams };
        return next;
      }
      return [...prev, { ingredientId, grams }];
    });
  }

  function setItemGrams(ingredientId: number, grams: number) {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.ingredientId === ingredientId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ingredientId, grams };
        return next;
      }
      return [...prev, { ingredientId, grams }];
    });
  }

  // ----- Step navigation -----------------------------------------------------
  const isComplianceStep = stepIdx >= COMPLIANCE_INDEX;
  const currentStep: WizardStep | null = isComplianceStep ? null : WIZARD_STEPS[stepIdx];

  function nextStep() {
    setStepIdx((i) => Math.min(i + 1, COMPLIANCE_INDEX));
  }
  function prevStep() {
    setStepIdx((i) => Math.max(i - 1, 0));
  }

  // ----- Render --------------------------------------------------------------
  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8">
        <WizardHeader
          stepIdx={stepIdx}
          totalSteps={TOTAL_STEPS}
          recipeName={recipeName}
          isSaving={isSaving}
          onOpenSave={() => setSaveOpen(true)}
          itemsCount={items.length}
          isEditing={isEditing}
        />

        <div className="grid grid-cols-12 gap-4 sm:gap-5 mt-4 sm:mt-6">
          {/* Left rail: Pet Profile + Starting Volume + Summary */}
          <div className="col-span-12 lg:col-span-3 space-y-4 lg:sticky lg:top-20 self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <PetProfilePane value={pet} onChange={setPet} lang={lang} />

            <Card className="p-4 space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("starting_volume", lang)}
              </Label>
              <Input
                type="number"
                value={startingVolume}
                onChange={(e) => setStartingVolume(parseInt(e.target.value || "0", 10))}
                min={100}
                max={10000}
                step={50}
                data-numeric="true"
              />
              <div className="text-xs text-muted-foreground">
                {t("used", lang)}: <span data-numeric="true">{items.reduce((s, i) => s + i.grams, 0).toFixed(0)}</span>g
              </div>
            </Card>

            <SummaryCard
              macros={macros}
              daily={daily}
              totals={totals}
              species={pet.species}
              isGrowth={isGrowth}
              lang={lang}
            />
          </div>

          {/* Center: step card */}
          <div className="col-span-12 lg:col-span-6 space-y-4">
            {currentStep ? (
              <NutrientStepCard
                step={currentStep}
                pet={pet}
                items={items}
                aafco={aafco}
                totals={totals}
                startingVolume={startingVolume}
                onAdd={upsertItem}
                onSetGrams={setItemGrams}
                onSkip={nextStep}
                onBack={prevStep}
                isFirstStep={stepIdx === 0}
              />
            ) : (
              <ComplianceCheckCard
                aafco={aafco}
                items={items}
                totalDM_g={macros.totalDryMatter_g}
                onAdd={incrementItem}
                onBack={prevStep}
                onFinish={() => setSaveOpen(true)}
                onGoToSimple={() =>
                  navigate(isEditing ? `/recipe/${recipeId}` : `/recipe/new`)
                }
              />
            )}

            {/* Always-visible recipe so far */}
            <RecipeSoFar
              items={items}
              onSetGrams={setItemGrams}
              onRemove={(id) => setItems((p) => p.filter((i) => i.ingredientId !== id))}
            />
          </div>

          {/* Right: live AAFCO compliance */}
          <div className="col-span-12 lg:col-span-3">
            <AafcoPanel rows={aafco} lang={lang} basis={"dm"} setBasis={() => undefined} />
          </div>
        </div>

        <SaveDialog
          open={saveOpen}
          setOpen={setSaveOpen}
          recipeName={recipeName}
          setRecipeName={setRecipeName}
          notes={notes}
          setNotes={setNotes}
          recipeStatus={recipeStatus}
          setRecipeStatus={setRecipeStatus}
          isEditing={isEditing}
          onSave={commitSave}
          isSaving={isSaving}
        />
      </div>
    </AppShell>
  );
}

// ============================================================================
// Header
// ============================================================================

function WizardHeader({
  stepIdx,
  totalSteps,
  recipeName,
  isSaving,
  onOpenSave,
  itemsCount,
  isEditing,
}: {
  stepIdx: number;
  totalSteps: number;
  recipeName: string;
  isSaving: boolean;
  onOpenSave: () => void;
  itemsCount: number;
  isEditing: boolean;
}) {
  const [lang] = useLang();
  const progressPct = ((stepIdx + 1) / totalSteps) * 100;
  const labelEn = stepIdx >= totalSteps - 1
    ? "Compliance check"
    : `Step ${stepIdx + 1} of ${totalSteps - 1}`;
  const labelZh = stepIdx >= totalSteps - 1
    ? "合规检查"
    : `第 ${stepIdx + 1} / ${totalSteps - 1} 步`;
  const labelTh = stepIdx >= totalSteps - 1
    ? "ตรวจ Compliance"
    : `ขั้นที่ ${stepIdx + 1} / ${totalSteps - 1}`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Sparkles className="size-3" /> {t("workflow_wizard", lang)}
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold mt-1 truncate">
          {recipeName || t("nav_new", lang)}
        </h1>
        <div className="mt-3 max-w-md">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{lang === "zh" ? labelZh : lang === "th" ? labelTh : labelEn}</span>
            <span data-numeric="true">{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>
      </div>
      <Button onClick={onOpenSave} disabled={itemsCount === 0 || isSaving}>
        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {isEditing ? t("update_recipe", lang) : t("save_recipe", lang)}
      </Button>
    </div>
  );
}

// ============================================================================
// Carb kcal-share panel (used inside carb steps)
// ============================================================================

function CarbKcalSharePanel({
  share,
  species,
  lang,
}: {
  share: CarbKcalShare;
  species: "dog" | "cat";
  lang: "en" | "zh" | "th";
}) {
  const labelMap = {
    en: { title: "Carbs as % of calories", optimal: "Optimal", ok: "OK", low: "Too low", high: "Too high", empty: "Add ingredients to compute" },
    zh: { title: "碳水占总卡路里 %",      optimal: "最佳", ok: "可接受", low: "过低", high: "过高", empty: "添加食材以计算" },
    th: { title: "คาร์บ % ของแคลอรี",   optimal: "เหมาะสม", ok: "ยอมรับได้", low: "ต่ำเกินไป", high: "สูงเกินไป", empty: "เพิ่มวัตถุดิบเพื่อคำนวณ" },
  };
  const L = labelMap[lang];

  let badge = "bg-secondary text-muted-foreground";
  let badgeText: string;
  if (share.status === "empty") { badgeText = L.empty; }
  else if (share.status === "optimal") { badge = "bg-emerald-100 text-emerald-700"; badgeText = L.optimal; }
  else if (share.status === "ok")      { badge = "bg-amber-100 text-amber-700";   badgeText = L.ok; }
  else if (share.status === "alert_low")  { badge = "bg-red-100 text-red-700";    badgeText = L.low; }
  else                                  { badge = "bg-red-100 text-red-700";       badgeText = L.high; }

  // Pretty range string per species
  const range = species === "cat" ? "0–10% optimal · 10–20% ok · ≥20% alert" : "20–30% optimal · 30–40% ok · <20% or >40% alert";

  return (
    <div className="rounded-md border border-border p-3 bg-card space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{L.title}</div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge}`}>{badgeText}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span data-numeric="true" className="text-2xl font-semibold">
          {share.status === "empty" ? "—" : share.pct.toFixed(1)}
        </span>
        <span className="text-sm text-muted-foreground">%</span>
        <span className="text-xs text-muted-foreground ml-auto" data-numeric="true">
          {share.carb_g.toFixed(0)} g · {share.carb_kcal.toFixed(0)} kcal
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground">{range}</div>
    </div>
  );
}

// ============================================================================
// Nutrient step card (Steps 1..13)
// ============================================================================

function NutrientStepCard({
  step,
  pet,
  items,
  aafco,
  totals,
  startingVolume,
  onAdd,
  onSetGrams,
  onSkip,
  onBack,
  isFirstStep,
}: {
  step: WizardStep;
  pet: PetProfileState;
  items: RecipeItem[];
  aafco: AafcoRow[];
  totals: NutrientTotals;
  startingVolume: number;
  onAdd: (ingredientId: number, grams: number) => void;
  onSetGrams: (ingredientId: number, grams: number) => void;
  onSkip: () => void;
  onBack: () => void;
  isFirstStep: boolean;
}) {
  const [lang] = useLang();
  const [pickedId, setPickedId] = useState<number>(step.defaults[0].ingredientId);
  const [grams, setGrams] = useState<number>(initialGrams(step, pet, startingVolume));

  // Reset when step changes
  useEffect(() => {
    setPickedId(step.defaults[0].ingredientId);
    setGrams(initialGrams(step, pet, startingVolume));
  }, [step.id, pet.species, startingVolume]);

  const ingredient = INGREDIENT_BY_ID[pickedId];
  const targetRow = step.nutrientKey
    ? aafco.find((r) => r.nutrient.key === step.nutrientKey)
    : null;

  // ---- Multi B-vitamin handling ------------------------------------------
  // For the dedicated B-complex step we don't grade success on a single
  // nutrient (B1) anymore — we evaluate ALL B vitamins (B1, B2, B3/niacin,
  // B5, B6, folate, B12). Choline has its own wizard step.
  const isBComplexStep = step.kind === "vit_b_complex";
  const totalRecipe_g = items.reduce((s, i) => s + i.grams, 0);
  const totalDM_g = Math.max(totalRecipe_g - totals.water_g, 0);
  const bReport: BComplexReport | null = isBComplexStep
    ? bComplexReport(aafco, totalDM_g, totalRecipe_g || startingVolume)
    : null;

  const stepDone = isBComplexStep ? !!bReport?.allMet : targetRow?.status === "ok";

  // When this is the B-complex step and the picked ingredient is brewer's yeast,
  // pre-fill the suggested grams with the report's recommendation (capped at 2%).
  useEffect(() => {
    if (!isBComplexStep || !bReport) return;
    if (pickedId !== 157) return; // only brewer's yeast
    const next = Math.round(bReport.recommendedYeastGrams * 10) / 10;
    if (next > 0 && Math.abs(next - grams) > 0.05) {
      setGrams(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBComplexStep, pickedId, bReport?.recommendedYeastGrams]);

  const inRecipe = items.find((i) => i.ingredientId === pickedId);

  // Free-text search across ALL 238 ingredients (overrides the curated top-30
  // list when a query is entered, so users can pick anything by exact name).
  const [search, setSearch] = useState("");

  // Build alternative ingredient list (DB sorted by step's nutrient + step's allowedCategories)
  const alternatives = useMemo(() => {
    const baseIds = new Set([
      step.defaults[0].ingredientId,
      ...(step.alternatives ?? []),
    ]);
    if (!step.nutrientKey) {
      // For macro_protein/macro_carb, just rank by category list and protein/carb_g
      const sortKey = step.kind === "macro_protein" ? "protein_g" : "carb_g";
      return INGREDIENTS
        .filter((i) =>
          step.allowedCategories ? step.allowedCategories.includes(i.category) : true,
        )
        .sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))
        .slice(0, 30);
    }
    const k = step.nutrientKey as keyof Ingredient;
    const ranked = INGREDIENTS
      .filter((i) =>
        step.allowedCategories ? step.allowedCategories.includes(i.category) : true,
      )
      .sort((a, b) => ((b[k] as number) ?? 0) - ((a[k] as number) ?? 0))
      .slice(0, 30);
    // Always include explicit alternatives even if not in the top
    const result = [...ranked];
    baseIds.forEach((id) => {
      const alt = INGREDIENT_BY_ID[id];
      if (alt && !result.find((r) => r.id === id)) result.push(alt);
    });
    return result;
  }, [step.id]);

  // When the user types into the search box, switch to a free-pick list of
  // every ingredient whose EN/ZH/TH name (or category) contains the query.
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const filtered = INGREDIENTS.filter((i) => {
      return (
        i.name_en.toLowerCase().includes(q) ||
        i.name_zh.toLowerCase().includes(q) ||
        i.name_th.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      );
    });
    // Still rank matches by the step's nutrient density when relevant.
    if (step.nutrientKey) {
      const k = step.nutrientKey as keyof Ingredient;
      filtered.sort((a, b) => ((b[k] as number) ?? 0) - ((a[k] as number) ?? 0));
    }
    return filtered.slice(0, 100);
  }, [search, step.nutrientKey]);

  // Whichever list we render: free-text search if any, otherwise the curated top-30.
  const visibleList = searchResults ?? alternatives;

  const titleByLang =
    lang === "zh" ? step.title_zh : lang === "th" ? step.title_th : step.title_en;
  const descByLang =
    lang === "zh" ? step.desc_zh : lang === "th" ? step.desc_th : step.desc_en;
  const hintByLang =
    lang === "zh" ? step.hint_zh : lang === "th" ? step.hint_th : step.hint_en;

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {step.id}
          </div>
          <h2 className="font-display text-2xl font-semibold mt-1">{titleByLang}</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">{descByLang}</p>
        </div>
        {stepDone && (
          <div className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
            <Check className="size-3" /> {t("status_ok", lang)}
          </div>
        )}
      </div>

      {/* Suggestion summary */}
      {ingredient && (
        <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Leaf className="size-4 text-primary" />
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {lang === "zh" ? "我们的建议" : lang === "th" ? "คำแนะนำของเรา" : "Suggestion"}
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <div className="font-medium text-lg">{ingredientName(ingredient, lang)}</div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={grams}
                onChange={(e) => setGrams(parseFloat(e.target.value || "0"))}
                step={0.5}
                min={0}
                className="w-24 h-9 text-right"
                data-numeric="true"
              />
              <span className="text-xs text-muted-foreground">{t("grams", lang)}</span>
            </div>
          </div>
          {step.nutrientKey && (
            <div data-numeric="true" className="text-xs text-muted-foreground">
              {nutrientLabelByKey(step.nutrientKey, lang)}:{" "}
              <span className="font-medium text-foreground">
                {((ingredient[step.nutrientKey as keyof Ingredient] as number) * grams / 100).toFixed(2)}
              </span>{" "}
              {step.nutrientKey.endsWith("_ug") ? "μg" :
                step.nutrientKey.endsWith("_mg") ? "mg" : "g"}
            </div>
          )}
          {hintByLang && (
            <div className="text-xs text-muted-foreground">{hintByLang}</div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button onClick={() => {
              if (inRecipe) onSetGrams(pickedId, grams);
              else onAdd(pickedId, grams);
              toast.success(`${ingredientName(ingredient, lang)} +${grams} g`);
            }}>
              <Check className="size-4" />
              {inRecipe
                ? lang === "zh" ? "更新用量" : lang === "th" ? "อัปเดตปริมาณ" : "Update grams"
                : lang === "zh" ? "加入配方" : lang === "th" ? "เพิ่มเข้าสูตร" : "Add to recipe"}
            </Button>
            <Button variant="outline" onClick={onSkip}>
              {lang === "zh" ? "跳过" : lang === "th" ? "ข้าม" : "Skip"}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Alternatives — sortable shortlist + free search */}
      <div>
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {searchResults
              ? (lang === "zh" ? "搜索结果" : lang === "th" ? "ผลการค้นหา" : "Search results")
              : (lang === "zh" ? "其他选择" : lang === "th" ? "ตัวเลือกอื่น" : "Other options")}
            {step.nutrientKey && !searchResults && (
              <span className="text-muted-foreground/70 normal-case ml-2 lowercase">
                · {lang === "zh" ? "按密度排序" : lang === "th" ? "เรียงตามความเข้มข้น" : "ranked by density"}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {visibleList.length} {lang === "zh" ? "项" : lang === "th" ? "รายการ" : "items"}
          </div>
        </div>
        <div className="relative mb-2">
          <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === "zh" ? "搜索所有 238 种食材 (中文 / 英文 / 泰文)" :
                lang === "th" ? "ค้นหาวัตถุดิบทั้ง 238 รายการ" :
                "Search any of 238 ingredients (EN / 中文 / ไทย)"
            }
            className="h-8 pl-8 pr-8 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <ScrollArea className="h-[260px] rounded-md border border-border">
          <div className="divide-y divide-border">
            {visibleList.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                {lang === "zh" ? "未找到匹配项" : lang === "th" ? "ไม่พบรายการที่ตรง" : "No matching ingredient"}
              </div>
            )}
            {visibleList.map((ing) => {
              const v = step.nutrientKey
                ? ((ing[step.nutrientKey as keyof Ingredient] as number) ?? 0)
                : (ing.protein_g ?? 0);
              const unit = step.nutrientKey?.endsWith("_ug") ? "μg" :
                step.nutrientKey?.endsWith("_mg") ? "mg" : "g";
              const isPicked = ing.id === pickedId;
              return (
                <button
                  key={ing.id}
                  onClick={() => setPickedId(ing.id)}
                  className={`w-full flex items-center justify-between gap-2 py-2 px-3 text-left transition-colors ${
                    isPicked ? "bg-primary/10" : "hover:bg-secondary/60"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{ingredientName(ing, lang)}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {ing.category} · {ing.energy_kcal.toFixed(0)} kcal/100g
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div data-numeric="true" className="text-sm font-medium">{v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)}</div>
                    <div className="text-[10px] text-muted-foreground">{unit}/100g</div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Live B-vitamin status — only on the B-complex step */}
      {isBComplexStep && bReport && (
        <BVitaminPanel report={bReport} lang={lang} />
      )}

      {/* Live progress on this nutrient (single-nutrient steps only) */}
      {!isBComplexStep && targetRow && (
        <div className="rounded-md border border-border p-3 bg-card">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            {nutrientLabelByKey(targetRow.nutrient.key, lang)} · {targetRow.nutrient.unit}
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm">
              {t("status", lang)}:{" "}
              <span className={`font-semibold ${statusColor(targetRow.status)}`}>
                {statusLabel(targetRow.status, lang)}
              </span>
            </div>
            <div data-numeric="true" className="text-sm">
              {targetRow.perKgDM.toFixed(2)} / min {targetRow.min ?? "—"}
              {targetRow.max !== null ? ` / max ${targetRow.max}` : ""}
            </div>
          </div>
        </div>
      )}

      {/* Carb kcal-share gate (grains+roots together) */}
      {step.kind === "macro_carb" && (
        <CarbKcalSharePanel share={carbKcalShare(totals, pet.species)} lang={lang} species={pet.species} />
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" onClick={onBack} disabled={isFirstStep}>
          <ArrowLeft className="size-4" />
          {lang === "zh" ? "上一步" : lang === "th" ? "ย้อนกลับ" : "Back"}
        </Button>
        <Button variant="outline" onClick={onSkip}>
          {lang === "zh" ? "下一步" : lang === "th" ? "ถัดไป" : "Next"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

// ============================================================================
// Step 14 — Compliance Check
// ============================================================================

function ComplianceCheckCard({
  aafco,
  items,
  totalDM_g,
  onAdd,
  onBack,
  onFinish,
  onGoToSimple,
}: {
  aafco: AafcoRow[];
  items: RecipeItem[];
  totalDM_g: number;
  onAdd: (ingredientId: number, grams: number) => void;
  onBack: () => void;
  onFinish: () => void;
  onGoToSimple: () => void;
}) {
  const [lang] = useLang();
  const excludeIds = items.map((i) => i.ingredientId);

  const gaps = useMemo(
    () => suggestRemediations(aafco, totalDM_g, excludeIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aafco, totalDM_g, items.length],
  );

  const allOk = gaps.length === 0;

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
            <ListChecks className="size-3" />
            {lang === "zh" ? "最终步骤" : lang === "th" ? "ขั้นสุดท้าย" : "Final step"}
          </div>
          <h2 className="font-display text-2xl font-semibold mt-1">
            {lang === "zh" ? "AAFCO 合规检查" : lang === "th" ? "ตรวจ AAFCO Compliance" : "AAFCO Compliance Check"}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            {lang === "zh"
              ? "我们扫描了配方,以下营养素仍低于 AAFCO 最低要求。每一项都可用鲜食或食品添加剂(如蛋壳粉、盐、啤酒酵母等)补足。"
              : lang === "th"
                ? "ระบบสแกนสูตรแล้ว สารอาหารต่อไปนี้ยังต่ำกว่าค่าต่ำสุด AAFCO เลือกเสริมด้วยวัตถุดิบสด หรือสารเสริมอาหาร (เช่น ผงเปลือกไข่ เกลือ ยีสต์เบียร์)"
                : "We scanned your recipe. The nutrients below are still under AAFCO minimum. For each gap, you can either add more of a fresh ingredient OR close it with a dedicated food additive."}
          </p>
        </div>
        {allOk && (
          <div className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
            <Check className="size-3" /> {lang === "zh" ? "全部达标" : lang === "th" ? "ครบถ้วนแล้ว" : "All AAFCO targets met"}
          </div>
        )}
      </div>

      {allOk ? (
        <Card className="border-dashed bg-emerald-50/40 p-6 text-center text-sm text-muted-foreground">
          {lang === "zh"
            ? "🎉 配方已满足全部 AAFCO 最低要求。可保存配方或继续微调。"
            : lang === "th"
              ? "🎉 สูตรนี้ตรงตามมาตรฐาน AAFCO ครบทุกข้อ บันทึกได้เลย"
              : "🎉 Your recipe meets every AAFCO minimum. You're ready to save."}
        </Card>
      ) : (
        <div className="space-y-4">
          {gaps.map((g) => (
            <GapRow key={g.row.nutrient.key} gap={g} onAdd={onAdd} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" />
          {lang === "zh" ? "返回上一步" : lang === "th" ? "ย้อนกลับ" : "Back"}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onGoToSimple}>
            {lang === "zh" ? "前往简单模式微调" : lang === "th" ? "ไปโหมดง่ายเพื่อปรับ" : "Open Simple Composer"}
          </Button>
          <Button onClick={onFinish}>
            <Save className="size-4" />
            {lang === "zh" ? "完成并保存" : lang === "th" ? "เสร็จและบันทึก" : "Finish & save"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function GapRow({
  gap,
  onAdd,
}: {
  gap: ReturnType<typeof suggestRemediations>[number];
  onAdd: (ingredientId: number, grams: number) => void;
}) {
  const [lang] = useLang();
  const [mode, setMode] = useState<"fresh" | "additive">("additive");
  const { row, fresh, additive } = gap;

  return (
    <Card className="p-4 space-y-3 border-amber-300/60 bg-amber-50/30">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="font-medium">
            {nutrientLabelByKey(row.nutrient.key, lang)}
          </div>
          <div className="text-xs text-muted-foreground">
            {lang === "zh" ? "目前" : lang === "th" ? "ปัจจุบัน" : "Now"}{" "}
            <span data-numeric="true" className="font-medium text-foreground">
              {row.perKgDM.toFixed(2)}
            </span>{" "}
            {row.nutrient.unit} /{" "}
            {lang === "zh" ? "最低" : lang === "th" ? "ขั้นต่ำ" : "min"}{" "}
            <span data-numeric="true" className="font-medium text-foreground">
              {row.min}
            </span>
          </div>
        </div>
        <div className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
          {lang === "zh" ? "不足" : lang === "th" ? "ต่ำกว่า" : "Below"}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 border border-border rounded-md p-0.5 w-fit text-xs">
        <button
          onClick={() => setMode("additive")}
          className={`px-2.5 py-1 rounded ${
            mode === "additive" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          <FlaskConical className="size-3 inline-block mr-1" />
          {lang === "zh" ? "食品添加剂" : lang === "th" ? "สารเสริม" : "Food additive"}
        </button>
        <button
          onClick={() => setMode("fresh")}
          className={`px-2.5 py-1 rounded ${
            mode === "fresh" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          <Leaf className="size-3 inline-block mr-1" />
          {lang === "zh" ? "鲜食材" : lang === "th" ? "วัตถุดิบสด" : "Fresh ingredient"}
        </button>
      </div>

      {mode === "additive" && additive && (
        <div className="rounded-md bg-white border border-border p-3 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium">{ingredientName(additive.ingredient, lang)}</div>
            <div className="text-xs text-muted-foreground">
              {additive.densityPer100g.toFixed(0)}{" "}
              {row.nutrient.key.endsWith("_ug") ? "μg" : row.nutrient.key.endsWith("_mg") ? "mg" : "g"}/100g
              {additive.cappedAtMax && (
                <span className="ml-2 text-amber-700">
                  · {lang === "zh" ? "已达到建议上限,可能仍有不足" :
                     lang === "th" ? "ถึงค่าสูงสุดที่แนะนำแล้ว อาจยังไม่ครบ" :
                     "max recommended dose"}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div data-numeric="true" className="text-base font-semibold">
              +{formatGrams(additive.gramsNeeded)} g
            </div>
            <Button
              size="sm"
              className="mt-1"
              onClick={() => {
                onAdd(additive.ingredient.id, parseFloat(formatGrams(additive.gramsNeeded)));
                toast.success(`${ingredientName(additive.ingredient, lang)} +${formatGrams(additive.gramsNeeded)} g`);
              }}
            >
              <Check className="size-3.5" />
              {lang === "zh" ? "加入" : lang === "th" ? "เพิ่ม" : "Add"}
            </Button>
          </div>
        </div>
      )}

      {mode === "additive" && !additive && (
        <div className="text-xs text-muted-foreground italic">
          {lang === "zh" ? "暂无对应的食品添加剂建议,请使用鲜食材选项。" :
            lang === "th" ? "ไม่มีคำแนะนำสารเสริมสำหรับสารอาหารนี้ ใช้ตัวเลือกวัตถุดิบสด" :
            "No dedicated additive available — use fresh ingredient option."}
        </div>
      )}

      {mode === "fresh" && (
        <div className="space-y-1.5">
          {fresh.length === 0 && (
            <div className="text-xs text-muted-foreground italic">
              {lang === "zh" ? "数据库中无足够密度的鲜食材。" :
                lang === "th" ? "ไม่มีวัตถุดิบสดที่หนาแน่นพอในฐานข้อมูล" :
                "No dense fresh source in database."}
            </div>
          )}
          {fresh.map((s) => (
            <div
              key={s.ingredient.id}
              className="rounded-md bg-white border border-border p-2.5 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{ingredientName(s.ingredient, lang)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {s.ingredient.category} · {s.densityPer100g.toFixed(1)}{" "}
                  {row.nutrient.key.endsWith("_ug") ? "μg" : row.nutrient.key.endsWith("_mg") ? "mg" : "g"}/100g
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
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// Recipe so far panel (small, always visible inside center column)
// ============================================================================

function RecipeSoFar({
  items,
  onSetGrams,
  onRemove,
}: {
  items: RecipeItem[];
  onSetGrams: (id: number, g: number) => void;
  onRemove: (id: number) => void;
}) {
  const [lang] = useLang();
  if (items.length === 0) {
    return (
      <Card className="p-5 text-sm text-muted-foreground italic border-dashed">
        {t("recipe_empty", lang)}
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {t("current_recipe", lang)}
        </div>
        <div className="text-xs text-muted-foreground">
          {items.length} {t("ingredients_count", lang)}
        </div>
      </div>
      <div className="divide-y divide-border">
        {items.map((it) => {
          const ing = INGREDIENT_BY_ID[it.ingredientId];
          if (!ing) return null;
          return (
            <div key={it.ingredientId} className="flex items-center gap-2 py-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{ingredientName(ing, lang)}</div>
                <div className="text-[11px] text-muted-foreground truncate">{ing.category}</div>
              </div>
              <Input
                type="number"
                value={it.grams}
                onChange={(e) => onSetGrams(it.ingredientId, parseFloat(e.target.value || "0"))}
                step={0.5}
                className="w-20 h-8 text-right"
                data-numeric="true"
              />
              <span className="text-xs text-muted-foreground">g</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(it.ingredientId)}
                className="size-7 text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ============================================================================
// Save dialog
// ============================================================================

function SaveDialog({
  open,
  setOpen,
  recipeName,
  setRecipeName,
  notes,
  setNotes,
  recipeStatus,
  setRecipeStatus,
  isEditing,
  onSave,
  isSaving,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  recipeName: string;
  setRecipeName: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  recipeStatus: "draft" | "approved";
  setRecipeStatus: (v: "draft" | "approved") => void;
  isEditing: boolean;
  onSave: () => void;
  isSaving: boolean;
}) {
  const [lang] = useLang();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("update_recipe", lang) : t("save_recipe", lang)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("recipe_name", lang)}</Label>
            <Input
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              placeholder="e.g., Bella's senior chicken"
              autoFocus
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>{t("notes", lang)}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>{t("status", lang)}</Label>
            <Select
              value={recipeStatus}
              onValueChange={(v) => setRecipeStatus(v as "draft" | "approved")}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("status_draft", lang)}</SelectItem>
                <SelectItem value="approved">{t("status_approved", lang)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isEditing ? t("update_recipe", lang) : t("save_recipe", lang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// B-vitamin status panel (used inside NutrientStepCard for the B-complex step)
// ============================================================================

function BVitaminPanel({
  report,
  lang,
}: {
  report: BComplexReport;
  lang: "en" | "zh" | "th";
}) {
  const headerLabel =
    lang === "zh"
      ? "B族维生素状态"
      : lang === "th"
        ? "สถานะวิตามินบีรวม"
        : "B-vitamin status";
  const subLabel = report.allMet
    ? lang === "zh"
      ? "全部B族维生素已达标"
      : lang === "th"
        ? "วิตามินบีรวมผ่านเกณฑ์ครบถ้วน"
        : "All B vitamins meet AAFCO"
    : lang === "zh"
      ? `${report.belowCount} 个B维生素不足`
      : lang === "th"
        ? `${report.belowCount} ตัวต่ำกว่าเกณฑ์`
        : `${report.belowCount} below AAFCO min`;

  const yeastLine = !report.allMet
    ? lang === "zh"
      ? `推荐加入啤酒酵母 ${report.recommendedYeastGrams.toFixed(1)} g（上限 ${report.yeastCap_g.toFixed(1)} g — 配方重量的 2%）`
      : lang === "th"
        ? `แนะนำยีสต์เบียร์ ${report.recommendedYeastGrams.toFixed(1)} ก. (สูงสุด ${report.yeastCap_g.toFixed(1)} ก. — 2% ของน้ำหนักสูตร)`
        : `Add brewer's yeast ≈ ${report.recommendedYeastGrams.toFixed(1)} g (max ${report.yeastCap_g.toFixed(1)} g — 2% of recipe weight)`
    : null;

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border bg-secondary/40">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {headerLabel}
        </div>
        <div
          className={`text-xs font-medium ${
            report.allMet ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {subLabel}
        </div>
      </div>
      <ul className="divide-y divide-border">
        {report.perVitamin.map((v) => {
          const isBad = v.status === "below" || v.status === "borderline";
          const isOk = v.status === "ok";
          const rowClass = isBad
            ? "bg-red-50/60"
            : isOk
              ? "bg-emerald-50/40"
              : "";
          const statusText = isOk
            ? lang === "zh"
              ? "达标"
              : lang === "th"
                ? "ผ่าน"
                : "ok"
            : v.status === "below"
              ? lang === "zh"
                ? "不足"
                : lang === "th"
                  ? "ต่ำกว่า"
                  : "below"
              : v.status === "borderline"
                ? lang === "zh"
                  ? "边缘"
                  : lang === "th"
                    ? "ใกล้"
                    : "close"
                : v.status === "above"
                  ? lang === "zh"
                    ? "偏高"
                    : lang === "th"
                      ? "สูง"
                      : "above"
                  : "—";
          const statusColorClass = isOk
            ? "text-emerald-700"
            : v.status === "below"
              ? "text-red-700"
              : v.status === "borderline"
                ? "text-amber-700"
                : v.status === "above"
                  ? "text-orange-700"
                  : "text-muted-foreground";
          return (
            <li
              key={v.key}
              className={`px-3 py-1.5 flex items-center justify-between gap-2 text-xs ${rowClass}`}
            >
              <div className="flex-1 min-w-0">
                {nutrientLabelByKey(v.key, lang)}
              </div>
              <div
                data-numeric="true"
                className="text-muted-foreground tabular-nums whitespace-nowrap"
              >
                {v.row
                  ? `${v.row.perKgDM.toFixed(2)} / min ${v.row.min ?? "—"} ${v.row.nutrient.unit.replace("/kg DM", "")}`
                  : "no benchmark"}
              </div>
              <div className={`w-12 text-right font-medium ${statusColorClass}`}>
                {statusText}
              </div>
            </li>
          );
        })}
      </ul>
      {yeastLine && (
        <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-amber-50/40">
          {yeastLine}
          {report.cappedAt2Pct && (
            <span className="ml-1 text-amber-700">
              {lang === "zh"
                ? "· 2%上限不足以完全弥补，考虑加入动物肝脓或鲑鱼。"
                : lang === "th"
                  ? "· ไม่พอที่จะปิดช่องว่างได้หมดด้วยยีสต์ พิจารณาตับสัตว์ หรือปลาซาร์ดีน"
                  : "· The 2% cap may not fully close all gaps; consider adding organ meat (liver) or sardines as well."}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function initialGrams(step: WizardStep, pet: PetProfileState, startingVolume: number): number {
  const def = step.defaults[0];
  if (step.kind === "macro_protein") return suggestedProteinGrams(pet.species, startingVolume);
  if (step.kind === "macro_carb") return Math.round(suggestedCarbGrams(pet.species, startingVolume) / 2);
  if (def.isPercentOfVolume) return Math.round(startingVolume * (def.grams / 100));
  return def.grams;
}

function nutrientLabelByKey(key: string, lang: "en" | "zh" | "th"): string {
  const labels: Record<string, [string, string, string]> = {
    protein_g: ["Protein", "蛋白质", "โปรตีน"],
    fat_g: ["Fat", "脂肪", "ไขมัน"],
    carb_g: ["Carbs", "碳水化合物", "คาร์โบไฮเดรต"],
    calcium_mg: ["Calcium", "钙", "แคลเซียม"],
    phosphorus_mg: ["Phosphorus", "磷", "ฟอสฟอรัส"],
    sodium_mg: ["Sodium", "钠", "โซเดียม"],
    potassium_mg: ["Potassium", "钾", "โพแทสเซียม"],
    magnesium_mg: ["Magnesium", "镁", "แมกนีเซียม"],
    iron_mg: ["Iron", "铁", "ธาตุเหล็ก"],
    zinc_mg: ["Zinc", "锌", "สังกะสี"],
    copper_mg: ["Copper", "铜", "ทองแดง"],
    manganese_mg: ["Manganese", "锰", "แมงกานีส"],
    selenium_ug: ["Selenium", "硒", "ซีลีเนียม"],
    vit_a_re_ug: ["Vitamin A", "维生素A", "วิตามินเอ"],
    vit_d_ug: ["Vitamin D", "维生素D", "วิตามินดี"],
    vit_e_mg: ["Vitamin E", "维生素E", "วิตามินอี"],
    vit_b1_mg: ["Thiamine (B1)", "维生素B1", "วิตามินบี1"],
    vit_b2_mg: ["Riboflavin (B2)", "维生素B2", "วิตามินบี2"],
    niacin_mg: ["Niacin (B3)", "维生素B3", "วิตามินบี3"],
    vit_b5_mg: ["Pantothenic (B5)", "维生素B5", "วิตามินบี5"],
    vit_b6_mg: ["Pyridoxine (B6)", "维生素B6", "วิตามินบี6"],
    vit_b12_ug: ["Vitamin B12", "维生素B12", "วิตามินบี12"],
    folate_mg: ["Folate", "叶酸", "โฟเลต"],
    choline_mg: ["Choline", "胆碱", "โคลีน"],
  };
  const entry = labels[key];
  if (!entry) return key;
  return lang === "zh" ? entry[1] : lang === "th" ? entry[2] : entry[0];
}

function statusColor(status: AafcoRow["status"]): string {
  if (status === "ok") return "text-emerald-600";
  if (status === "borderline") return "text-amber-600";
  if (status === "below") return "text-red-600";
  if (status === "above") return "text-orange-600";
  return "text-muted-foreground";
}

function statusLabel(status: AafcoRow["status"], lang: "en" | "zh" | "th"): string {
  return t(
    status === "ok" ? "status_ok" :
      status === "below" ? "status_below" :
        status === "borderline" ? "status_borderline" :
          status === "above" ? "status_above" : "status_no_target",
    lang,
  );
}
