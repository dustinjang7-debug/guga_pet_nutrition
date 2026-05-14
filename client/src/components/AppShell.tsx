import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { getLoginUrl } from "@/const";
import { type Lang, t, useLang } from "@/lib/i18n";
import { LogOut, Menu, Sprout } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

function getInitial(name?: string | null, email?: string | null): string {
  const source = (name || email || "").trim();
  if (!source) return "?";
  const codePoint = source.codePointAt(0);
  return codePoint ? String.fromCodePoint(codePoint).toUpperCase() : "?";
}

const LANG_LABEL: Record<Lang, string> = {
  en: "EN",
  zh: "中文",
  th: "ไทย",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [lang, setLang] = useLang();
  const [location] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems: { href: string; label: string; match: (l: string) => boolean }[] = [
    { href: "/", label: t("nav_home", lang), match: (l) => l === "/" },
    { href: "/wizard/new", label: t("workflow_wizard", lang), match: (l) => l.startsWith("/wizard") },
    { href: "/recipe/new", label: t("workflow_simple", lang), match: (l) => l.startsWith("/recipe") },
    { href: "/premix/new", label: t("premix_composer", lang), match: (l) => l.startsWith("/premix") },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur-sm sticky top-0 z-30 bg-background/85">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Logo (compact on mobile) */}
          <Link href="/" className="flex items-center gap-2 group shrink-0 min-w-0">
            <div className="size-8 sm:size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Sprout className="size-4 sm:size-5" strokeWidth={2.2} />
            </div>
            <div className="leading-tight min-w-0">
              <div className="font-display text-sm sm:text-base font-semibold truncate">
                {t("appName", lang)}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground tracking-wide hidden sm:block truncate">
                {t("tagline", lang)}
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                  item.match(location)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Language switcher — compact on mobile */}
            <div className="hidden sm:flex items-center rounded-md border border-border bg-card overflow-hidden">
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
            {/* Mobile lang: cycles through EN → 中 → TH */}
            <button
              className="sm:hidden px-2 py-1 text-xs font-medium border border-border rounded-md bg-card"
              onClick={() => {
                const order: Lang[] = ["en", "zh", "th"];
                const i = order.indexOf(lang);
                setLang(order[(i + 1) % order.length]);
              }}
            >
              {LANG_LABEL[lang]}
            </button>

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    title={user?.name ?? undefined}
                    className="hidden md:flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-secondary/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar className="size-7">
                      {user?.picture ? (
                        <AvatarImage
                          src={user.picture}
                          alt={user?.name ?? ""}
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {getInitial(user?.name, user?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground hidden md:inline truncate max-w-[14ch]">
                      {user?.name}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate">
                        {user?.name ?? user?.email ?? ""}
                      </span>
                      {user?.email && user?.name ? (
                        <span className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </span>
                      ) : null}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => { void logout(); }}>
                    <LogOut className="size-4" />
                    {t("nav_logout", lang)}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm">
                <a href={getLoginUrl()}>{t("sign_in", lang)}</a>
              </Button>
            )}

            {/* Mobile hamburger */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle>{t("appName", lang)}</SheetTitle>
                </SheetHeader>
                <nav className="mt-4 flex flex-col gap-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      className={`px-3 py-2.5 text-sm rounded-md transition-colors ${
                        item.match(location)
                          ? "bg-secondary text-foreground font-medium"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <div className="mt-6 pt-4 border-t border-border space-y-3">
                  <div className="flex items-center rounded-md border border-border bg-card overflow-hidden w-fit">
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
                  {isAuthenticated && (
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="size-7 shrink-0">
                          {user?.picture ? (
                            <AvatarImage
                              src={user.picture}
                              alt={user?.name ?? ""}
                              referrerPolicy="no-referrer"
                            />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {getInitial(user?.name, user?.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-foreground truncate">{user?.name ?? user?.email}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={logout}>
                        <LogOut className="size-4" />
                        {t("nav_logout", lang)}
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
