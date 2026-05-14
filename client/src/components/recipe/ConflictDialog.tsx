/**
 * Last-write-wins conflict resolution dialog.
 *
 * Shown when an `update` mutation comes back with code=CONFLICT — meaning
 * someone else changed the recipe between when we loaded and when we saved.
 * The user picks: overwrite anyway, save as a duplicate (own copy), or
 * cancel and reload to see the latest.
 */

import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConflictInfo {
  lastUpdatedAt?: string | null;
  lastUpdatedByName?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflict: ConflictInfo | null;
  onOverwrite: () => void;
  onDuplicate: () => void;
  /**
   * Discard local edits and refetch the latest server state. Wired by the
   * builder to invalidate the recipes.get query and reset the editor's
   * dirty buffer so the user sees the other writer's version.
   */
  onCancelAndReload: () => void;
  pending?: boolean;
}

export function ConflictDialog({
  open,
  onOpenChange,
  conflict,
  onOverwrite,
  onDuplicate,
  onCancelAndReload,
  pending,
}: Props) {
  const who = conflict?.lastUpdatedByName ?? "Someone else";
  const when = conflict?.lastUpdatedAt
    ? new Date(conflict.lastUpdatedAt).toLocaleString()
    : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Edited by someone else
          </DialogTitle>
          <DialogDescription>
            {who} saved changes to this recipe{when ? ` at ${when}` : ""}. Overwriting
            will discard their edits. You can also keep both by saving your version
            as a duplicate.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onCancelAndReload} disabled={pending}>
            <RefreshCw className="size-4" />
            Cancel and reload
          </Button>
          <Button variant="outline" onClick={onDuplicate} disabled={pending}>
            Save as duplicate
          </Button>
          <Button variant="destructive" onClick={onOverwrite} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Overwrite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
