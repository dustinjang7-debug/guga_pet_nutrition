import { useAuth } from "@/_core/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { ingredientName, t, useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import type { Ingredient } from "@shared/ingredients";
import { INGREDIENTS } from "@shared/ingredients";
import { ArrowRight, FilePen, Loader2, Sparkles, Trash2, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { ImportRecipeButton } from "@/components/ImportRecipeButton";

export default function Home() {
  const [lang] = useLang();
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <AppShell>
        <div className="h-[60vh] flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppShell>
        <Hero />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <RecipesList onNew={() => setLocation("/recipe/new")} />
    </AppShell>
  );
}

function Hero() {
  const [lang] = useLang();
  return (
    <section className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-16 pb-24">
      <div className="grid lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-7">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-5">
            {t("appName", lang)} · v1
          </div>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.02] tracking-tight">
            {t("welcome_title", lang)}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
            {t("welcome_body", lang)}
          </p>
          <div className="mt-10 flex items-center gap-3">
            <Button size="lg" asChild>
              <a href={getLoginUrl()}>
                {t("sign_in", lang)} <ArrowRight className="ml-1.5 size-4" />
              </a>
            </Button>
          </div>
          <div className="mt-16 grid sm:grid-cols-3 gap-6 max-w-2xl">
            <Stat number="238" label={lang === "zh" ? "已核验食材" : lang === "th" ? "วัตถุดิบที่ตรวจสอบแล้ว" : "Verified ingredients"} />
            <Stat number="29" label={lang === "zh" ? "营养素跟踪" : lang === "th" ? "สารอาหารที่ติดตาม" : "Nutrients tracked"} />
            <Stat number="2" label={lang === "zh" ? "犬 & 猫 AAFCO" : lang === "th" ? "AAFCO สุนัข & แมว" : "AAFCO Dog & Cat"} />
          </div>
        </div>

        <div className="lg:col-span-5 lg:pl-6">
          <FeatureSample />
        </div>
      </div>
    </section>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="border-l-2 border-primary/40 pl-4">
      <div data-numeric="true" className="text-3xl font-semibold text-foreground">{number}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function FeatureSample() {
  const [lang] = useLang();
  // pick a few representative ingredients to show off the trilingual db
  const samples: Ingredient[] = [
    INGREDIENTS.find((i) => i.id === 159)!,    // eggshell powder
    INGREDIENTS.find((i) => i.id === 60)!,     // chicken breast (approx — id from db ordering)
    INGREDIENTS.find((i) => i.name_zh.includes("鸡肝"))!,
    INGREDIENTS.find((i) => i.name_zh.includes("三文鱼") || i.name_zh.includes("鲑鱼"))!,
    INGREDIENTS.find((i) => i.name_zh.includes("蛋黄"))!,
  ].filter(Boolean);

  return (
    <Card className="p-6 bg-card/80 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="size-4 text-primary" />
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {lang === "zh" ? "数据库预览" : lang === "th" ? "ตัวอย่างฐานข้อมูล" : "Database preview"}
        </div>
      </div>
      <div className="space-y-2">
        {samples.map((ing) => (
          <div key={ing.id} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border/60 last:border-0">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{ingredientName(ing, lang)}</div>
              <div className="text-xs text-muted-foreground truncate">
                {lang !== "en" && ing.name_en + " · "}
                {lang !== "zh" && ing.name_zh + " · "}
                {lang !== "th" && ing.name_th}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div data-numeric="true" className="text-sm font-medium">
                {ing.energy_kcal.toFixed(0)} <span className="text-muted-foreground text-xs">kcal</span>
              </div>
              <div data-numeric="true" className="text-xs text-muted-foreground">
                P {ing.protein_g.toFixed(1)} · F {ing.fat_g.toFixed(1)} · C {ing.carb_g.toFixed(1)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecipesList({ onNew }: { onNew: () => void }) {
  const [lang] = useLang();
  const recipesQuery = trpc.recipes.list.useQuery();
  const utils = trpc.useUtils();
  const del = trpc.recipes.delete.useMutation({
    onSuccess: () => utils.recipes.list.invalidate(),
  });

  return (
    <section className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-12 pb-20">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
            {t("nav_home", lang)}
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
            {t("my_recipes", lang)}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ImportRecipeButton size="lg" variant="outline" />
          <Button onClick={() => (window.location.href = "/wizard/new")} size="lg" variant="default">
            <Sparkles className="size-4 mr-1.5" />
            {t("workflow_wizard", lang)}
          </Button>
          <Button onClick={onNew} size="lg" variant="outline">
            <FilePen className="size-4 mr-1.5" />
            {t("workflow_simple", lang)}
          </Button>
        </div>
      </div>

      {recipesQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !recipesQuery.data || recipesQuery.data.length === 0 ? (
        <Card className="p-16 text-center bg-secondary/40 border-dashed">
          <p className="text-muted-foreground">{t("empty_recipes", lang)}</p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button onClick={() => (window.location.href = "/wizard/new")}>
              <Sparkles className="size-4 mr-1.5" />
              {t("workflow_wizard", lang)}
            </Button>
            <Button variant="outline" onClick={onNew}>
              {t("workflow_simple", lang)}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipesQuery.data.map((r) => (
            <Card key={r.id} className="p-5 hover:shadow-md transition-shadow group flex flex-col">
              <Link href={`/recipe/${r.id}`} className="flex-1 cursor-pointer">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-display text-lg font-semibold leading-tight line-clamp-2">{r.name}</h3>
                  <div className="flex items-center gap-1 shrink-0">
                    {r.unseenActivityCount > 0 && (
                      <span
                        title={t("unseen_activity_tooltip", lang)}
                        className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-rose-500 text-white inline-flex items-center gap-1"
                        data-testid={`badge-unseen-${r.id}`}
                      >
                        {r.unseenActivityCount > 9 ? "9+" : r.unseenActivityCount} {t("unseen_activity_label", lang)}
                      </span>
                    )}
                    {r.role !== "owner" && (
                      <span className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 inline-flex items-center gap-1">
                        <Users className="size-2.5" />
                        {r.role}
                      </span>
                    )}
                    <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${r.status === "approved" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {r.status === "approved" ? t("status_approved", lang) : t("status_draft", lang)}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <div>
                    {r.species === "dog" ? t("species_dog", lang) : t("species_cat", lang)}
                    {r.petName ? ` · ${r.petName}` : ""}
                    {" · "}
                    <span data-numeric="true">{Number(r.bodyWeightKg).toFixed(1)}</span> kg
                  </div>
                  <div className="text-xs">{t("saved_at", lang)}: {new Date(r.updatedAt).toLocaleDateString()}</div>
                </div>
              </Link>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-end">
                {r.role === "owner" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm(t("confirm_delete", lang))) del.mutate({ id: r.id });
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
