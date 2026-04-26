import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { type AafcoRow, aafcoComparison, dailyFeed, recipeMacros, recipeTotals, type RecipeItem } from "@shared/calc";
import { DOG_LIFE_STAGES, CAT_LIFE_STAGES } from "@shared/aafco";
import type { Ingredient } from "@shared/ingredients";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

import { PetProfilePane, defaultPetProfile, type PetProfileState } from "@/components/recipe/PetProfile";
import { VolumeAndTargets, type MacroTargets } from "@/components/recipe/VolumeAndTargets";
import { IngredientPicker } from "@/components/recipe/IngredientPicker";
import { RecipeItemsList } from "@/components/recipe/RecipeItemsList";
import { AafcoPanel } from "@/components/recipe/AafcoPanel";
import { SummaryCard } from "@/components/recipe/SummaryCard";
import { AafcoFixSheet } from "@/components/recipe/AafcoFixSheet";

export default function RecipeBuilder() {
  const [lang] = useLang();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const recipeId = params.id ? parseInt(params.id, 10) : undefined;
  const isEditing = recipeId !== undefined && !isNaN(recipeId);

  // Pet + targets state
  const [pet, setPet] = useState<PetProfileState>(defaultPetProfile());
  const [startingVolume, setStartingVolume] = useState(1000);
  const [targets, setTargets] = useState<MacroTargets>({ proteinPct: 45, carbPct: 25 });

  // Recipe state
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [recipeName, setRecipeName] = useState("");
  const [notes, setNotes] = useState("");
  const [recipeStatus, setRecipeStatus] = useState<"draft" | "approved">("draft");
  const [basis, setBasis] = useState<"dm" | "me">("dm");

  // Load recipe if editing
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
    setItems(
      (itemsJson ?? []).map((it) => ({
        ingredientId: it.ingredientId,
        grams: typeof it.grams === "string" ? parseFloat(it.grams) : it.grams,
      })),
    );
  }, [recipeQuery.data]);

  // Live calculations (memoised)
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

  // Auto-fix sheet
  const [fixForKey, setFixForKey] = useState<string | null>(null);

  // Add / change / remove
  function addIngredient(ing: Ingredient, defaultGrams: number) {
    setItems((prev) => {
      const existing = prev.find((p) => p.ingredientId === ing.id);
      if (existing) return prev;
      return [...prev, { ingredientId: ing.id, grams: defaultGrams }];
    });
  }
  function changeGrams(ingredientId: number, grams: number) {
    setItems((prev) => prev.map((p) => (p.ingredientId === ingredientId ? { ...p, grams } : p)));
  }
  function removeItem(ingredientId: number) {
    setItems((prev) => prev.filter((p) => p.ingredientId !== ingredientId));
  }

  // Save / update
  const utils = trpc.useUtils();
  const createMut = trpc.recipes.create.useMutation({
    onSuccess: (data) => {
      utils.recipes.list.invalidate();
      toast.success(t("save_recipe", lang) + " ✓");
      navigate(`/recipes/${data.id}`);
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
      workflow: "simple" as const,
      petName: pet.petName,
      petId: pet.petId,
      items: items.map((i) => ({ ingredientId: i.ingredientId, grams: i.grams })),
    };
    if (isEditing) updateMut.mutate({ id: recipeId!, data: payload });
    else createMut.mutate(payload);
    setSaveOpen(false);
  }

  const isSaving = createMut.isPending || updateMut.isPending;
  const used = items.reduce((s, i) => s + i.grams, 0);

  return (
    <AppShell>
      <div className="container max-w-[1400px] py-6 lg:py-8">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {isEditing ? t("update_recipe", lang) : t("nav_new", lang)}
            </div>
            <h1 className="font-display text-3xl font-bold mt-1">
              {recipeName || t("nav_new", lang)}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
              <DialogTrigger asChild>
                <Button disabled={items.length === 0 || isSaving}>
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
                    <Select value={recipeStatus} onValueChange={(v) => setRecipeStatus(v as "draft" | "approved")}>
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
                  <Button variant="outline" onClick={() => setSaveOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={commitSave}>
                    {isEditing ? t("update_recipe", lang) : t("save_recipe", lang)}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 3-column layout */}
        <div className="grid grid-cols-12 gap-5">
          {/* Left rail: Pet profile + volume/targets — sticky */}
          <div className="col-span-12 lg:col-span-3 space-y-4 lg:sticky lg:top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
            <PetProfilePane value={pet} onChange={setPet} lang={lang} />
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
            />
            <SummaryCard macros={macros} daily={daily} lang={lang} />
          </div>

          {/* Center: ingredient picker + recipe items */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <div className="h-[600px]">
              <IngredientPicker onPick={addIngredient} lang={lang} />
            </div>
            <RecipeItemsList items={items} onChangeGrams={changeGrams} onRemove={removeItem} lang={lang} />
          </div>

          {/* Right: AAFCO panel */}
          <div className="col-span-12 lg:col-span-4">
            <AafcoPanel
              rows={aafco}
              lang={lang}
              basis={basis}
              setBasis={setBasis}
              onAutoFix={(k) => setFixForKey(k)}
            />
          </div>
          <AafcoFixSheet
            open={fixForKey !== null}
            onOpenChange={(o) => !o && setFixForKey(null)}
            nutrientKey={fixForKey}
            aafco={aafco}
            items={items}
            totalDM_g={macros.totalDryMatter_g}
            onAdd={(ingredientId, grams) => {
              setItems((prev) => {
                const idx = prev.findIndex((p) => p.ingredientId === ingredientId);
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
