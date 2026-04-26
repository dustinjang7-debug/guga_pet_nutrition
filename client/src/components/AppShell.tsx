import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { type Lang, t, useLang } from "@/lib/i18n";
import { LogOut, Sprout } from "lucide-react";
import { Link, useLocation } from "wouter";

const LANG_LABEL: Record<Lang, string> = {
  en: "EN",
  zh: "中文",
  th: "ไทย",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [lang, setLang] = useLang();
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur-sm sticky top-0 z-30 bg-background/85">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-6">
          <Link href="/">
            <a className="flex items-center gap-2.5 group">
              <div className="size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                <Sprout className="size-5" strokeWidth={2.2} />
              </div>
              <div className="leading-tight">
                <div className="font-display text-base font-semibold">{t("appName", lang)}</div>
                <div className="text-[11px] text-muted-foreground tracking-wide">{t("tagline", lang)}</div>
              </div>
            </a>
          </Link>

          <nav className="flex items-center gap-1">
            <Link href="/">
              <a className={`px-3 py-1.5 text-sm rounded-md transition-colors ${location === "/" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t("nav_home", lang)}
              </a>
            </Link>
            <Link href="/recipe/new">
              <a className={`px-3 py-1.5 text-sm rounded-md transition-colors ${location.startsWith("/recipe") ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t("nav_new", lang)}
              </a>
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border bg-card overflow-hidden">
              {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    lang === l
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {LANG_LABEL[l]}
                </button>
              ))}
            </div>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden md:inline">
                  {user?.name}
                </span>
                <Button variant="ghost" size="icon" onClick={logout} title={t("nav_logout", lang)}>
                  <LogOut className="size-4" />
                </Button>
              </div>
            ) : (
              <Button asChild>
                <a href={getLoginUrl()}>{t("sign_in", lang)}</a>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
