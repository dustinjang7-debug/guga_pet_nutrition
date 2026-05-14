/**
 * Owner-only sharing dialog: rotate the share link, manage collaborators
 * (promote viewer ⇄ editor or remove), and disable the link.
 *
 * Viewers and editors see a read-only "shared with you" notice instead.
 */

import { useState } from "react";
import { Copy, Link as LinkIcon, Loader2, RefreshCw, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

interface Props {
  recipeId: number;
  role: "owner" | "editor" | "viewer" | null;
}

function shareUrl(token: string): string {
  if (typeof window === "undefined") return `/r/${token}`;
  return `${window.location.origin}/r/${token}`;
}

export function ShareDialog({ recipeId, role }: Props) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const shareQuery = trpc.recipes.share.get.useQuery({ id: recipeId }, { enabled: open });
  const createOrRotate = trpc.recipes.share.createOrRotate.useMutation({
    onSuccess: () => {
      utils.recipes.share.get.invalidate({ id: recipeId });
      toast.success("Share link ready");
    },
    onError: (e) => toast.error(e.message),
  });
  const disable = trpc.recipes.share.disable.useMutation({
    onSuccess: () => {
      utils.recipes.share.get.invalidate({ id: recipeId });
      toast.success("Link disabled");
    },
    onError: (e) => toast.error(e.message),
  });
  const setRole = trpc.recipes.share.setRole.useMutation({
    onSuccess: () => {
      utils.recipes.share.get.invalidate({ id: recipeId });
      toast.success("Role updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const removeCollab = trpc.recipes.share.removeCollaborator.useMutation({
    onSuccess: () => {
      utils.recipes.share.get.invalidate({ id: recipeId });
      toast.success("Removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const isOwner = role === "owner";
  const link = shareQuery.data?.link;
  const collaborators = shareQuery.data?.collaborators ?? [];
  const owner = shareQuery.data?.owner ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="size-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share recipe</DialogTitle>
          <DialogDescription>
            {isOwner
              ? "Send the link to give someone view-only access. You can promote viewers to editors below."
              : role === "editor"
                ? "You have editor access. Only the owner can manage sharing."
                : "You have view-only access to this recipe."}
          </DialogDescription>
        </DialogHeader>

        {shareQuery.isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Link */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                <LinkIcon className="inline size-3 mr-1" /> Share link
              </Label>
              {link && link.isActive ? (
                <div className="flex gap-2">
                  <Input readOnly value={shareUrl(link.token)} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shareUrl(link.token));
                        toast.success("Copied");
                      } catch {
                        toast.error("Copy failed");
                      }
                    }}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active share link.</p>
              )}
              {isOwner && (
                <div className="flex gap-2 pt-1">
                  <Button
                    variant={link?.isActive ? "outline" : "default"}
                    size="sm"
                    onClick={() => createOrRotate.mutate({ id: recipeId })}
                    disabled={createOrRotate.isPending}
                  >
                    <RefreshCw className="size-3.5 mr-1" />
                    {link?.isActive ? "Rotate link" : "Create link"}
                  </Button>
                  {link?.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disable.mutate({ id: recipeId })}
                      disabled={disable.isPending}
                    >
                      Disable
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Collaborators */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                <Users className="inline size-3 mr-1" /> People with access
              </Label>
              <ul className="space-y-1.5">
                {/* Owner row — informational only, never editable. */}
                {owner && (
                  <li className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {owner.name ?? owner.email ?? `User #${owner.userId}`}
                      </div>
                      {owner.email && owner.name && (
                        <div className="text-xs text-muted-foreground truncate">{owner.email}</div>
                      )}
                    </div>
                    <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                      Owner
                    </span>
                  </li>
                )}
                {collaborators.length === 0 ? (
                  <li className="text-sm text-muted-foreground px-1">
                    No-one else has access yet. The link grants viewer access.
                  </li>
                ) : (
                  collaborators.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{c.name ?? c.email ?? `User #${c.userId}`}</div>
                        {c.email && c.name && (
                          <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isOwner ? (
                          <>
                            <Select
                              value={c.role}
                              onValueChange={(v) =>
                                setRole.mutate({ id: recipeId, userId: c.userId, role: v as "viewer" | "editor" })
                              }
                            >
                              <SelectTrigger className="h-8 w-[100px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeCollab.mutate({ id: recipeId, userId: c.userId })}
                              title="Remove access"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {c.role}
                          </span>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            <X className="size-4" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
