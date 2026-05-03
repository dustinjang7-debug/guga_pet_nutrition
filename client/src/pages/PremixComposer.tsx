import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useLang, t, ingredientName } from "@/lib/i18n";
import {
  type AafcoRow, aafcoComparison, dailyFeed, recipeMacros, recipeTotals, type RecipeItem,
} from "@shared/calc";
import { DOG_LIFE_STAGES, CAT_LIFE_STAGES } from "@shared/aafco";
import {
  type Ingredient,
  INGREDIENT_BY_ID,
  PREMIX_BASIC_ID,
  PREMIX_UPGRADE_ID,
  PREMIX_IDS,
} from "@shared/ingredients";
import { computeSachetDose, GRAMS_PER_SACHET } from "@shared/sachetDose";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Save, Loader2, AlertTriangle, Package } from "lucide-react";

import { ExportPdfButton } from "@/components/ExportPdfButton";
import { PetProfilePane, defaultPetProfile, type PetProfileState } from "@/components/recipe/PetProfile";
import { VolumeAndTargets, type MacroTargets } from "@/components/recipe/VolumeAndTargets";
import { StartingVolumeStrip } from "@/components/recipe/StartingVolumeStrip";
import { IngredientPicker } from "@/components/recipe/IngredientPicker";
import { RecipeItemsList } from "@/components/recipe/RecipeItemsList";
import { AafcoPanel } from "@/components/recipe/AafcoPanel";
import { SummaryCard } from "@/components/recipe/SummaryCard";
import { AafcoFixSheet } from "@/components/recipe/AafcoFixSheet";

type PremixSku = typeof PREMIX_BASIC_ID | typeof PREMIX_UPGRADE_ID;

/**
 * Premix Composer = Simple Composer (RecipeBuilder) with one extra block:
 *
 *   Pet Profile  →  Premix card (BASIC/UPGRADE + auto sachet dose)  →  rest is identical.
 *
 * The Premix row is locked at the top of Current Recipe, dose snaps to whole sachets
 * derived from pet body weight via shared/sachetDose. Everything else (DER, AAFCO,
 * autofix, picker, save, PDF) is the same as Simple Composer.
 */
export default function PremixComposer() {
  const [lang] = useLang();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const recipeId = params.id ? parseInt(params.id, 10) : undefined;
  const isEditing = recipeId !== undefined && !isNaN(recipeId);

  // Pet + targets
  const [pet, setPet] = useState<PetProfileState>(defaultPetProfile());
  const [startingVolume, setStartingVolume] = useState(1000);
  const [targets, setTargets] = useState<MacroTargets>({ proteinPct: 45, carbPct: 25 });

  // Recipe
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [locks, setLocks] = useState<Set<number>>(new Set());
  const [recipeName, setRecipeName] = useState("");
  const [notes, setNotes] = useState("");
  const [recipeStatus, setRecipeStatus] = useState<"draft" | "approved">("draft");
  const [basis, setBasis] = useState<"dm" | "me">("dm");

  // Premix-specific
  const [premixSku, setPremixSku] = useState<PremixSku>(PREMIX_BASIC_ID);

  // Sachet dose for current pet weight (rule in shared/sachetDose.ts)
  const dose = useMemo(() => computeSachetDose(pet.bodyWeightKg), [pet.bodyWeightKg]);
  const premixGrams = dose.ok ? dose.gramsPerDay : 0;

  // Keep premix row in sync with SKU + dose. Premix is always the first row when
  // the weight is in range, even before the user picks any fresh ingredient.
  useEffect(() => {
    setItems(prev => {
      const cleaned = prev.filter(
        i => !PREMIX_IDS.includes(i.ingredientId as typeof PREMIX_IDS[number]),
      );
      if (premixGrams <= 0) return cleaned;
      return [{ ingredientId: premixSku, grams: premixGrams }, ...cleaned];
    });
  }, [premixSku, premixGrams]);

  // Load recipe (edit mode)
  const recipeQuery = trpc.recipes.get.useQuery({ id: recipeId! }, { enabled: isEditing });
  useEffect(() => {
    const r = recipeQuery.data;
    if (!r) return;
    setRecipeName(r.name);
    setNotes(r.notes ?? "");
    setRecipeStatus(r.status as "draft" | "approved");
    setStartingVolume(r.startingVolumeG);
    setTargets({
      proteinPct: r.targetProteinPct ? parseFloat(String(r.targetProteinPct)) : 45,
      carbPct: r.targetCarbPct ? parseFloat(String(r.targetCarbPct)) : 25,
    });
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
    const loaded = (itemsJson ?? []).map(it => ({
      ingredientId: it.ingredientId,
      grams: typeof it.grams === "string" ? parseFloat(it.grams) : it.grams,
    }));
    const sku = loaded.find(i => i.ingredientId === PREMIX_UPGRADE_ID)
      ? PREMIX_UPGRADE_ID
      : PREMIX_BASIC_ID;
    setPremixSku(sku as PremixSku);
    setItems(loaded);
  }, [recipeQuery.data]);

  // Live calcs (identical to Simple Composer)
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

  const [fixForKey, setFixForKey] = useState<string | null>(null);

  function addIngredient(ing: Ingredient, defaultGrams: number) {
    setItems(prev => {
      if (prev.find(p => p.ingredientId === ing.id)) return prev;
      return [...prev, { ingredientId: ing.id, grams: defaultGrams }];
    });
  }
  function removeItem(ingredientId: number) {
    if (PREMIX_IDS.includes(ingredientId as typeof PREMIX_IDS[number])) return;
    setItems(prev => prev.filter(p => p.ingredientId !== ingredientId));
    setLocks(prev => {
      if (!prev.has(ingredientId)) return prev;
      const next = new Set(prev);
      next.delete(ingredientId);
      return next;
    });
  }
  function toggleLock(ingredientId: number) {
    setLocks(prev => {
      const next = new Set(prev);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });
  }

  const utils = trpc.useUtils();
  const createMut = trpc.recipes.create.useMutation({
    onSuccess: data => {
      utils.recipes.list.invalidate();
      toast.success(t("save_recipe", lang) + " ✓");
      navigate(`/premix/${data.id}`);
    },
    onError: e => toast.error(e.message),
  });
  const updateMut = trpc.recipes.update.useMutation({
    onSuccess: () => {
      utils.recipes.list.invalidate();
      utils.recipes.get.invalidate({ id: recipeId! });
      toast.success(t("update_recipe", lang) + " ✓");
    },
    onError: e => toast.error(e.message),
  });

  const [saveOpen, setSaveOpen] = useState(false);
  function commitSave() {
    if (!recipeName.trim()) {
      toast.error("Recipe name required");
      return;
    }
    const payload = {
      name: recipeName.trim(),
      notes: notes.trim(),
      status: recipeStatus,
      startingVolumeG: startingVolume,
      targetProteinPct: targets.proteinPct,
      targetCarbPct: targets.carbPct,
      species: pet.species,
      bodyWeightKg: pet.bodyWeightKg,
      lifeStage: pet.lifeStageKey,
      lifeStageFactor: pet.factor,
      feedingMode: pet.feedingMode,
      workflow: "premix" as const,
      petName: pet.petName,
      petId: pet.petId,
      items: items.map(i => ({ ingredientId: i.ingredientId, grams: i.grams })),
    };
    if (isEditing) updateMut.mutate({ id: recipeId!, data: payload });
    else createMut.mutate(payload);
    setSaveOpen(false);
  }

  const isSaving = createMut.isPending || updateMut.isPending;
  const used = items.reduce((s, i) => s + i.grams, 0);
  const premixIngredient = INGREDIENT_BY_ID[premixSku];

  return (
    <AppShell>
      <div className="container max-w-[1400px] py-6 lg:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {t("premix_composer", lang)}
            </div>
            <h1 className="font-display text-3xl font-bold mt-1">
              {recipeName || t("premix_composer", lang)}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ExportPdfButton recipeId={isEditing ? recipeId : undefined} />
            <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
              <DialogTrigger asChild>
                <Button disabled={!dose.ok || isSaving}>
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {isEditing ? t("update_recipe", lang) : t("save_recipe", lang)}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEditing ? t("update_recipe", lang) : t("save_recipe", lang)}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>{t("recipe_name", lang)}</Label>
                    <Input
                      value={recipeName}
                      onChange={e => setRecipeName(e.target.value)}
                      placeholder="e.g., Bella's premix lunch"
                      autoFocus
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>{t("notes", lang)}</Label>
                    <Textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>{t("status", lang)}</Label>
                    <Select value={recipeStatus} onValueChange={v => setRecipeStatus(v as "draft" | "approved")}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">{t("status_draft", lang)}</SelectItem>
                        <SelectItem value="approved">{t("status_approved", lang)}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSaveOpen(false)}>{t("cancel", lang)}</Button>
                  <Button onClick={commitSave}>
                    {isEditing ? t("update_recipe", lang) : t("save_recipe", lang)}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Same column structure as Simple Composer; Premix card is inserted
            right after PetProfile so it fits the natural top-down flow:
            pet → premix dose → DER summary → recipe rows. */}
        <div className="grid grid-cols-12 gap-5">
          {/* Left rail */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <PetProfilePane value={pet} onChange={setPet} lang={lang} />

            <PremixCard
              sku={premixSku}
              setSku={setPremixSku}
              dose={dose}
              ingredient={premixIngredient}
              derKcal={daily.derKcal}
              feedingGrams={daily.feedingGrams}
              lang={lang}
            />

            <SummaryCard
              macros={macros}
              daily={daily}
              totals={totals}
              species={pet.species}
              isGrowth={isGrowth}
              lang={lang}
            />
            <RecipeItemsList
              items={items}
              locks={locks}
              onItemsChange={setItems}
              onToggleLock={toggleLock}
              onClearLocks={() => setLocks(new Set())}
              onRemove={removeItem}
              fixedIds={[premixSku]}
              lang={lang}
            />
          </div>

          {/* Center: picker (sticky) */}
          <div className="col-span-12 lg:col-span-4">
            <div className="lg:sticky lg:top-20">
              <div className="h-[calc(100vh-6rem)]">
                <IngredientPicker
                  onPick={addIngredient}
                  lang={lang}
                  excludeIds={[...PREMIX_IDS]}
                />
              </div>
            </div>
          </div>

          {/* Right: AAFCO + StartingVolume + Targets (same as Simple Composer) */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <AafcoPanel
              rows={aafco}
              lang={lang}
              basis={basis}
              setBasis={setBasis}
              onAutoFix={k => setFixForKey(k)}
            />
            <StartingVolumeStrip
              startingVolume={startingVolume}
              setStartingVolume={setStartingVolume}
              used={used}
              lang={lang}
            />
            <VolumeAndTargets
              startingVolume={startingVolume}
              setStartingVolume={setStartingVolume}
              used={used}
              targets={targets}
              setTargets={setTargets}
              species={pet.species}
              feedingMode={pet.feedingMode}
              lang={lang}
              currentMacros={macros}
              showStartingVolume={false}
              collapsibleTargets
              defaultCollapsed
            />
          </div>

          <AafcoFixSheet
            open={fixForKey !== null}
            onOpenChange={o => !o && setFixForKey(null)}
            nutrientKey={fixForKey}
            aafco={aafco}
            items={items}
            totalDM_g={macros.totalDryMatter_g}
            onAdd={(ingredientId, grams) => {
              setItems(prev => {
                const idx = prev.findIndex(p => p.ingredientId === ingredientId);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = { ingredientId, grams: prev[idx].grams + grams };
                  return next;
                }
                return [...prev, { ingredientId, grams }];
              });
              setFixForKey(null);
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}

/* ------------------------------- Premix card ------------------------------ */

function PremixCard({
  sku,
  setSku,
  dose,
  ingredient,
  derKcal,
  feedingGrams,
  lang,
}: {
  sku: PremixSku;
  setSku: (s: PremixSku) => void;
  dose: ReturnType<typeof computeSachetDose>;
  ingredient: Ingredient | undefined;
  derKcal: number;
  feedingGrams: number;
  lang: ReturnType<typeof useLang>[0];
}) {
  return (
    <Card className="p-4 border-primary/30 bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Package className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="font-display font-semibold text-sm uppercase tracking-wider">
              {t("premix_sku", lang)}
            </div>
            <Select
              value={String(sku)}
              onValueChange={v => setSku(parseInt(v, 10) as PremixSku)}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(PREMIX_BASIC_ID)}>{t("basic", lang)}</SelectItem>
                <SelectItem value={String(PREMIX_UPGRADE_ID)}>{t("upgrade", lang)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground mt-1 truncate">
            {ingredient ? ingredientName(ingredient, lang) : ""}
          </div>

          {dose.ok ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-background/60 px-2 py-2">
                <div data-numeric="true" className="text-lg font-semibold tabular-nums">
                  {dose.sachets}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  {t("sachets_per_day", lang)}
                </div>
              </div>
              <div className="rounded-md bg-background/60 px-2 py-2">
                <div data-numeric="true" className="text-lg font-semibold tabular-nums">
                  {derKcal.toFixed(0)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  {t("daily_kcal_target", lang)}
                </div>
              </div>
              <div className="rounded-md bg-background/60 px-2 py-2">
                <div data-numeric="true" className="text-lg font-semibold tabular-nums">
                  {feedingGrams > 0 ? feedingGrams.toFixed(0) : "—"}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  {t("daily_feeding", lang)}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="size-4" />
              <span>{t("weight_out_of_range", lang)}</span>
            </div>
          )}

          <div className="text-[11px] text-muted-foreground mt-2">
            {dose.ok
              ? `${dose.gramsPerDay} g/day · ${GRAMS_PER_SACHET} g / ${t("sachet", lang)} · ${t("premix_locked_hint", lang)}`
              : t("premix_locked_hint", lang)}
          </div>
        </div>
      </div>
    </Card>
  );
}
