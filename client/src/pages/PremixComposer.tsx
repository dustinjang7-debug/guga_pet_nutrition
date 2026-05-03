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
import { IngredientPicker } from "@/components/recipe/IngredientPicker";
import { RecipeItemsList } from "@/components/recipe/RecipeItemsList";
import { AafcoPanel } from "@/components/recipe/AafcoPanel";
import { SummaryCard } from "@/components/recipe/SummaryCard";

type PremixSku = typeof PREMIX_BASIC_ID | typeof PREMIX_UPGRADE_ID;

export default function PremixComposer() {
  const [lang] = useLang();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const recipeId = params.id ? parseInt(params.id, 10) : undefined;
  const isEditing = recipeId !== undefined && !isNaN(recipeId);

  const [pet, setPet] = useState<PetProfileState>(defaultPetProfile());
  const [premixSku, setPremixSku] = useState<PremixSku>(PREMIX_BASIC_ID);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [locks, setLocks] = useState<Set<number>>(new Set());
  const [recipeName, setRecipeName] = useState("");
  const [notes, setNotes] = useState("");
  const [recipeStatus, setRecipeStatus] = useState<"draft" | "approved">("draft");
  const [basis, setBasis] = useState<"dm" | "me">("dm");

  // Sachet dose for current pet weight (1 sachet = 5 g; rule in shared/sachetDose.ts)
  const dose = useMemo(() => computeSachetDose(pet.bodyWeightKg), [pet.bodyWeightKg]);
  const premixGrams = dose.ok ? dose.gramsPerDay : 0;

  // Keep the premix row in sync with the SKU + sachet dose.
  // Premix is always present (even when items is empty for a new recipe).
  useEffect(() => {
    setItems(prev => {
      // Remove any old premix rows, drop the wrong SKU, then re-add the current SKU at top.
      const cleaned = prev.filter(i => !PREMIX_IDS.includes(i.ingredientId as typeof PREMIX_IDS[number]));
      if (premixGrams <= 0) return cleaned;
      return [{ ingredientId: premixSku, grams: premixGrams }, ...cleaned];
    });
  }, [premixSku, premixGrams]);

  // Load existing recipe (if editing)
  const recipeQuery = trpc.recipes.get.useQuery({ id: recipeId! }, { enabled: isEditing });
  useEffect(() => {
    const r = recipeQuery.data;
    if (!r) return;
    setRecipeName(r.name);
    setNotes(r.notes ?? "");
    setRecipeStatus(r.status as "draft" | "approved");
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
    // Detect SKU from saved items if present, else default to BASIC.
    const sku = loaded.find(i => i.ingredientId === PREMIX_UPGRADE_ID)
      ? PREMIX_UPGRADE_ID
      : PREMIX_BASIC_ID;
    setPremixSku(sku as PremixSku);
    setItems(loaded);
  }, [recipeQuery.data]);

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

  function addIngredient(ing: Ingredient, defaultGrams: number) {
    setItems(prev => {
      if (prev.find(p => p.ingredientId === ing.id)) return prev;
      return [...prev, { ingredientId: ing.id, grams: defaultGrams }];
    });
  }
  function removeItem(ingredientId: number) {
    if (PREMIX_IDS.includes(ingredientId as typeof PREMIX_IDS[number])) return; // protected
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

  // Save / update
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
      startingVolumeG: 1000,
      targetProteinPct: 45,
      targetCarbPct: 25,
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
            <p className="text-sm text-muted-foreground mt-1">
              {t("premix_composer_desc", lang)}
            </p>
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

        {/* Premix dose card */}
        <Card className="p-4 mb-5 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Package className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="font-display font-semibold text-sm uppercase tracking-wider">
                  {t("premix_sku", lang)}
                </div>
                <Select value={String(premixSku)} onValueChange={v => setPremixSku(parseInt(v, 10) as PremixSku)}>
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
                {premixIngredient ? ingredientName(premixIngredient, lang) : ""}
              </div>
              <div className="mt-3">
                {dose.ok ? (
                  <div data-numeric="true" className="text-sm">
                    <span className="font-medium text-foreground">{dose.sachets}</span>
                    <span className="text-muted-foreground"> {t("sachets_per_day", lang)} · {dose.gramsPerDay} g/day · {GRAMS_PER_SACHET} g / {t("sachet", lang)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-amber-700">
                    <AlertTriangle className="size-4" />
                    <span>{t("weight_out_of_range", lang)}</span>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-1">{t("premix_locked_hint", lang)}</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Three-column layout */}
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <PetProfilePane value={pet} onChange={setPet} lang={lang} />
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

          <div className="col-span-12 lg:col-span-4 space-y-4">
            <AafcoPanel
              rows={aafco}
              lang={lang}
              basis={basis}
              setBasis={setBasis}
              onAutoFix={() => {
                toast.info("Auto-fix is disabled in Premix mode — adjust fresh ingredients manually.");
              }}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
