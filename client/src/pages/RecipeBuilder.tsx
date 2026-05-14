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
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Save, Loader2, Eye } from "lucide-react";
import { TRPCClientError } from "@trpc/client";

import { ExportRecipeButton } from "@/components/ExportRecipeButton";
import { ShareDialog } from "@/components/recipe/ShareDialog";
import { HistoryPanel } from "@/components/recipe/HistoryPanel";
import { ConflictDialog, type ConflictInfo } from "@/components/recipe/ConflictDialog";
import { RebalanceSheet } from "@/components/recipe/RebalanceSheet";
import { Sparkles } from "lucide-react";
import { PetProfilePane, defaultPetProfile, type PetProfileState } from "@/components/recipe/PetProfile";
import { VolumeAndTargets, type MacroTargets } from "@/components/recipe/VolumeAndTargets";
import { StartingVolumeStrip } from "@/components/recipe/StartingVolumeStrip";
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
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [startingVolume, setStartingVolume] = useState(1000);
  const [targets, setTargets] = useState<MacroTargets>({ proteinPct: 45, carbPct: 25 });

  // Recipe state
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [locks, setLocks] = useState<Set<number>>(new Set());
  const [recipeName, setRecipeName] = useState("");
  const [notes, setNotes] = useState("");
  const [recipeStatus, setRecipeStatus] = useState<"draft" | "approved">("draft");
  const [basis, setBasis] = useState<"dm" | "me">("dm");

  // Tracks the last-known server timestamp so update can detect concurrent
  // edits via the server's `expectedUpdatedAt` check.
  const expectedUpdatedAtRef = useRef<Date | null>(null);
  const [role, setRole] = useState<"owner" | "editor" | "viewer" | null>(null);
  const isReadOnly = role === "viewer";

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
    setRole(r.role);
    expectedUpdatedAtRef.current = r.updatedAt ? new Date(r.updatedAt) : null;
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
    if (isReadOnly) return;
    setItems((prev) => {
      const existing = prev.find((p) => p.ingredientId === ing.id);
      if (existing) return prev;
      return [...prev, { ingredientId: ing.id, grams: defaultGrams }];
    });
  }
  function removeItem(ingredientId: number) {
    if (isReadOnly) return;
    setItems((prev) => prev.filter((p) => p.ingredientId !== ingredientId));
    setLocks((prev) => {
      if (!prev.has(ingredientId)) return prev;
      const next = new Set(prev);
      next.delete(ingredientId);
      return next;
    });
  }
  function toggleLock(ingredientId: number) {
    if (isReadOnly) return;
    setLocks((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });
  }

  // Save / update
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
    onSuccess: (data) => {
      utils.recipes.list.invalidate();
      utils.recipes.get.invalidate({ id: recipeId! });
      utils.recipes.history.invalidate({ id: recipeId! });
      if (data.updatedAt) expectedUpdatedAtRef.current = new Date(data.updatedAt);
      toast.success(t("update_recipe", lang) + " ✓");
    },
    onError: (e) => {
      const conflict = parseConflict(e);
      if (conflict) {
        setConflictInfo(conflict);
        setConflictOpen(true);
      } else {
        toast.error(e.message);
      }
    },
  });
  const duplicateMut = trpc.recipes.duplicate.useMutation({
    onSuccess: (data) => {
      utils.recipes.list.invalidate();
      toast.success("Saved as duplicate");
      setConflictOpen(false);
      navigate(`/recipe/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const [saveOpen, setSaveOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);

  function buildPayload() {
    return {
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
  }

  function commitSave(opts?: { force?: boolean }) {
    if (!recipeName.trim()) {
      toast.error("Recipe name required");
      return;
    }
    const payload = buildPayload();
    if (isEditing) {
      updateMut.mutate({
        id: recipeId!,
        data: payload,
        // Force-overwrite skips the concurrency check; otherwise we send the
        // last-known server timestamp so the server can reject stale writes.
        expectedUpdatedAt: opts?.force ? null : expectedUpdatedAtRef.current,
      });
    } else {
      createMut.mutate(payload);
    }
    setSaveOpen(false);
  }

  function onOverwriteConflict() {
    commitSave({ force: true });
  }

  function onDuplicateConflict() {
    if (!isEditing) return;
    duplicateMut.mutate({ id: recipeId! });
  }

  const isSaving = createMut.isPending || updateMut.isPending;
  const used = items.reduce((s, i) => s + i.grams, 0);

  return (
    <AppShell>
      <div className="container max-w-[1400px] py-6 lg:py-8">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              {isEditing ? t("update_recipe", lang) : t("nav_new", lang)}
              {role && role !== "owner" && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 normal-case tracking-normal">
                  {role === "viewer" && <Eye className="size-3" />}
                  Shared with you · {role}
                </span>
              )}
            </div>
            <h1 className="font-display text-3xl font-bold mt-1">
              {recipeName || t("nav_new", lang)}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && items.length > 0 && !isReadOnly && (
              <Button variant="outline" size="sm" onClick={() => setRebalanceOpen(true)}>
                <Sparkles className="size-4" />
                {t("rebalance_title", lang)}
              </Button>
            )}
            {isEditing && <HistoryPanel recipeId={recipeId!} />}
            {isEditing && role === "owner" && <ShareDialog recipeId={recipeId!} role={role} />}
            <ExportRecipeButton recipeId={isEditing ? recipeId : undefined} />
            {!isReadOnly && (
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
                    <Button onClick={() => commitSave()}>
                      {isEditing ? t("update_recipe", lang) : t("save_recipe", lang)}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <fieldset disabled={isReadOnly} className={isReadOnly ? "opacity-95" : ""}>
        <div className="grid grid-cols-12 gap-5">
          {/* Left rail */}
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
              lang={lang}
            />
          </div>

          {/* Center: picker only (sticky on lg+) */}
          <div className="col-span-12 lg:col-span-4">
            <div className="lg:sticky lg:top-20">
              <div className="h-[calc(100vh-6rem)]">
                <IngredientPicker onPick={addIngredient} lang={lang} />
              </div>
            </div>
          </div>

          {/* Right: AAFCO panel + collapsed StartingVolumeStrip + collapsed Macro Targets */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <AafcoPanel
              rows={aafco}
              lang={lang}
              basis={basis}
              setBasis={setBasis}
              onAutoFix={(k) => setFixForKey(k)}
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
          <RebalanceSheet
            open={rebalanceOpen}
            onOpenChange={setRebalanceOpen}
            items={items}
            species={pet.species}
            isGrowth={isGrowth}
            onApply={(newItems) => {
              setItems(newItems);
              toast.success(t("rebalance_apply", lang) + " ✓");
            }}
          />
        </div>
        </fieldset>
      </div>

      <ConflictDialog
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        conflict={conflictInfo}
        onOverwrite={onOverwriteConflict}
        onDuplicate={onDuplicateConflict}
        pending={updateMut.isPending || duplicateMut.isPending}
      />
    </AppShell>
  );
}

/**
 * The server signals concurrent-edit via TRPCError(code="CONFLICT"). We
 * pull the structured `cause` (lastUpdatedAt, lastUpdatedByName) off the
 * client error so the dialog can show *who* changed the recipe and *when*.
 */
function parseConflict(err: unknown): ConflictInfo | null {
  if (!(err instanceof TRPCClientError)) return null;
  if (err.data?.code !== "CONFLICT") return null;
  const cause = (err.shape?.data as { cause?: ConflictInfo } | undefined)?.cause;
  return cause ?? {};
}
