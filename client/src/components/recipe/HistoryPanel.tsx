/**
 * Recipe activity log — append-only entries with structured diffs for
 * `edited` / `status_changed` actions.
 */

import { History, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ingredientName } from "@/lib/i18n";
import { useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { INGREDIENT_BY_ID } from "@shared/ingredients";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface Props {
  recipeId: number;
}

interface IngredientChange {
  ingredientId: number;
  beforeGrams?: number;
  afterGrams?: number;
}

interface RecipeDiff {
  ingredientsAdded: IngredientChange[];
  ingredientsRemoved: IngredientChange[];
  ingredientsChanged: IngredientChange[];
  fields: { field: string; before: unknown; after: unknown }[];
}

const ACTION_LABEL: Record<string, string> = {
  created: "Created",
  edited: "Edited",
  status_changed: "Status changed",
  shared: "Shared",
  link_rotated: "Share link rotated",
  link_disabled: "Share link disabled",
  collaborator_added: "Collaborator added",
  collaborator_role_changed: "Collaborator role changed",
  collaborator_removed: "Collaborator removed",
  imported_from_pdf: "Imported from PDF",
  imported_from_file: "Imported from file",
  duplicated: "Duplicated from another recipe",
};

function formatGrams(g?: number) {
  if (g === undefined) return "—";
  return `${g.toFixed(g >= 10 ? 0 : 1)} g`;
}

function DiffSummary({ diff, lang }: { diff: RecipeDiff; lang: "en" | "zh" | "th" }) {
  const ingName = (id: number) => {
    const ing = INGREDIENT_BY_ID[id];
    return ing ? ingredientName(ing, lang) : `#${id}`;
  };
  return (
    <div className="text-xs text-muted-foreground space-y-1 mt-1">
      {diff.ingredientsAdded.map((c) => (
        <div key={`a-${c.ingredientId}`}>
          <span className="text-emerald-600">+ Added</span> {ingName(c.ingredientId)} ({formatGrams(c.afterGrams)})
        </div>
      ))}
      {diff.ingredientsRemoved.map((c) => (
        <div key={`r-${c.ingredientId}`}>
          <span className="text-red-600">− Removed</span> {ingName(c.ingredientId)} ({formatGrams(c.beforeGrams)})
        </div>
      ))}
      {diff.ingredientsChanged.map((c) => (
        <div key={`c-${c.ingredientId}`}>
          <span className="text-amber-600">~ Adjusted</span> {ingName(c.ingredientId)}: {formatGrams(c.beforeGrams)} → {formatGrams(c.afterGrams)}
        </div>
      ))}
      {diff.fields.map((f) => (
        <div key={f.field}>
          <span className="text-amber-600">~</span> {f.field}: <span className="line-through opacity-60">{f.before == null ? "—" : String(f.before)}</span> → {f.after == null ? "—" : String(f.after)}
        </div>
      ))}
    </div>
  );
}

export function HistoryPanel({ recipeId }: Props) {
  const [lang] = useLang();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  // The server marks the recipe as seen on every history fetch. Once the
  // panel finishes loading, invalidate the home list so the unread badge
  // disappears without requiring a manual refresh.
  const historyQuery = trpc.recipes.history.useQuery(
    { id: recipeId },
    {
      enabled: open,
    },
  );
  const isSuccess = historyQuery.isSuccess;
  useEffect(() => {
    if (open && isSuccess) {
      utils.recipes.list.invalidate();
    }
  }, [open, isSuccess, utils]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="size-4" />
          History
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Activity</SheetTitle>
          <SheetDescription>Most recent changes appear first.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {historyQuery.isLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !historyQuery.data || historyQuery.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">No activity yet.</p>
          ) : (
            <ol className="space-y-4 mt-4">
              {historyQuery.data.map((entry) => {
                const payload = (entry.payload ?? {}) as { diff?: RecipeDiff } & Record<string, unknown>;
                return (
                  <li key={entry.id} className="border-l-2 border-muted pl-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-sm font-medium">
                        {ACTION_LABEL[entry.action] ?? entry.action}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      by {entry.actorName ?? entry.actorEmail ?? `User #${entry.actorUserId}`}
                    </div>
                    {payload.diff && <DiffSummary diff={payload.diff} lang={lang} />}
                    {!payload.diff && payload.targetUserName !== undefined && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Target: {String(payload.targetUserName)}
                        {payload.role ? ` (${String(payload.role)})` : ""}
                      </div>
                    )}
                    {!payload.diff && Array.isArray(payload.droppedIngredientIds) &&
                      (payload.droppedIngredientIds as unknown[]).length > 0 && (
                        <div className="text-xs text-amber-600 mt-1">
                          Dropped {(payload.droppedIngredientIds as unknown[]).length} unknown ingredient(s)
                        </div>
                      )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
