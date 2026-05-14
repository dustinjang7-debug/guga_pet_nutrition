/**
 * /r/:token — share-link landing page.
 *
 * - Signed-out: prompts the user to sign in (preserving the redirect).
 * - Signed-in: calls `share.join` to add the user as a viewer (idempotent
 *   if they're already a collaborator or the owner) and redirects to
 *   /recipe/:id.
 * - Inactive token: shows a friendly "link expired" message.
 */

import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, Link2Off, ArrowRight } from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  const lookup = trpc.recipes.share.lookupByToken.useQuery(
    { token },
    { enabled: Boolean(token) },
  );
  const join = trpc.recipes.share.join.useMutation({
    onSuccess: (data) => navigate(`/recipe/${data.recipeId}`),
  });

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    if (lookup.isLoading || lookup.isError || !lookup.data) return;
    if (join.isIdle) join.mutate({ token });
  }, [isAuthenticated, loading, lookup.isLoading, lookup.isError, lookup.data, join, token]);

  return (
    <AppShell>
      <section className="max-w-xl mx-auto px-6 py-20">
        {loading || lookup.isLoading ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p>Opening shared recipe…</p>
          </div>
        ) : !lookup.data ? (
          <Card className="p-8 text-center space-y-3">
            <Link2Off className="size-8 mx-auto text-muted-foreground" />
            <h1 className="font-display text-2xl font-semibold">Link unavailable</h1>
            <p className="text-sm text-muted-foreground">
              This share link has been disabled or doesn't exist. Ask the recipe owner
              for a new one.
            </p>
            <Button onClick={() => navigate("/")} variant="outline">
              Back home
            </Button>
          </Card>
        ) : !isAuthenticated ? (
          <Card className="p-8 text-center space-y-4">
            <h1 className="font-display text-2xl font-semibold">
              {lookup.data.recipeName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to view this {lookup.data.species} recipe.
            </p>
            <Button asChild size="lg">
              <a href={`/api/auth/google/login?redirect=${encodeURIComponent(`/r/${token}`)}`}>
                Sign in to view <ArrowRight className="ml-1.5 size-4" />
              </a>
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p>Adding you as a viewer…</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
