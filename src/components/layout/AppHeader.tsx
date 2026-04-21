"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { AppSidebar } from "./AppSidebar";
import { CrmCommandPalette } from "./CrmCommandPalette";
import { ImpersonationSwitcher } from "./ImpersonationSwitcher";
import { tryReadResponseJson } from "@/lib/http/read-response-json";
import { cn } from "@/lib/utils";

function initialsFromName(name: string | null | undefined, email: string | null | undefined) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? "";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase() || "EN";
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "EN";
}

type AppHeaderProps = {
  sidebarCompact?: boolean;
  onToggleSidebar?: () => void;
};

type ThemeMode = "dark" | "light";
const THEME_STORAGE_KEY = "enver-crm-theme";
const ALERTS_POLL_MS = 60_000;

export function AppHeader({
  sidebarCompact = false,
  onToggleSidebar,
}: AppHeaderProps = {}) {
  const resolveInitialTheme = (): ThemeMode => {
    if (typeof document === "undefined") return "light";
    const htmlTheme = document.documentElement.getAttribute("data-theme");
    return htmlTheme === "dark" || htmlTheme === "light" ? htmlTheme : "light";
  };

  const reduceMotion = useReducedMotion();
  const [animationsReady, setAnimationsReady] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  /** Radix Sheet генерує aria-controls на клієнті; SSR дає інші id → гідратаційний розрив без defer. */
  const [mobileNavMounted, setMobileNavMounted] = useState(false);
  const [alertsUnread, setAlertsUnread] = useState(0);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return resolveInitialTheme();
  });
  const shouldAnimate = animationsReady && !reduceMotion;
  const canViewAlerts = Boolean(
    session?.user?.permissionKeys?.includes("NOTIFICATIONS_VIEW"),
  );

  const userInitials = initialsFromName(session?.user?.name, session?.user?.email);

  const title = getTitleFromPath(pathname);

  const applyTheme = (value: ThemeMode) => {
    const root = document.documentElement;
    root.setAttribute("data-theme", value);
    root.style.colorScheme = value;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/settings/communications/alerts/summary");
        const j = await tryReadResponseJson<{ unreadCount?: number }>(r);
        if (!r.ok || cancelled || !j) return;
        setAlertsUnread(Number(j.unreadCount ?? 0) || 0);
      } catch {
        if (!cancelled) setAlertsUnread(0);
      }
    };
    if (!canViewAlerts) return;
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, ALERTS_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [canViewAlerts]);

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimationsReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setMobileNavMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <motion.header
      className={cn(
        "flex h-14 items-center justify-between gap-3 border-b border-[var(--enver-border)] bg-[var(--enver-surface)]/95 px-3 backdrop-blur md:px-6",
        commandPaletteOpen && "relative z-[100]",
      )}
      initial={shouldAnimate ? { opacity: 0, y: -6 } : false}
      animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="flex items-center gap-2">
        {onToggleSidebar ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden md:inline-flex"
                aria-label={sidebarCompact ? "Розгорнути меню" : "Згорнути меню"}
                onClick={onToggleSidebar}
              >
                {sidebarCompact ? (
                  <PanelLeftOpen className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[14rem]">
              {sidebarCompact ? "Розгорнути бічну панель" : "Згорнути до іконок"}
            </TooltipContent>
          </Tooltip>
        ) : null}
        <div className="md:hidden">
          {mobileNavMounted ? (
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Відкрити меню"
                  title="Відкрити навігацію"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex h-full w-80 max-w-[min(100vw,22rem)] flex-col p-0"
              >
                <SheetTitle className="sr-only">Навігація CRM</SheetTitle>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <AppSidebar variant="drawer" className="border-r-0" />
                </div>
                <div className="shrink-0 border-t border-white/10 bg-[#2d1d45] p-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-white/25 bg-[var(--enver-card)]/10 text-white hover:bg-[var(--enver-card)]/15 hover:text-white"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className="h-4 w-4" />
                    Вийти
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Відкрити меню"
              disabled
              className="opacity-90"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-[var(--enver-text)]">
            {title}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="enver-status-chip" data-tone="ok">
              SHIFT ACTIVE
            </span>
            <span className="hidden text-[11px] text-[var(--enver-muted)] md:inline">
              ENVER CRM · production control room
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:gap-3">
        <CrmCommandPalette onOpenChange={setCommandPaletteOpen} />

        <ImpersonationSwitcher />

        {canViewAlerts ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="relative h-8 gap-1 border-[var(--enver-danger)]/40 bg-[var(--enver-danger-soft)] text-[11px] text-[var(--enver-danger)] hover:bg-[var(--enver-danger-soft)]"
              >
                <Link href="/dashboard/critical">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  NOC
                  {alertsUnread > 0 ? (
                    <span className="ml-1 inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-[var(--enver-danger)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {alertsUnread > 99 ? "99+" : alertsUnread}
                    </span>
                  ) : null}
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[16rem]">
              Центр критичних сповіщень: SLA, ризики, ескалації
            </TooltipContent>
          </Tooltip>
        ) : null}

        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={toggleTheme}
                aria-label={
                  theme === "dark"
                    ? "Увімкнути світлу тему"
                    : "Увімкнути темну тему"
                }
                title={
                  theme === "dark"
                    ? "Увімкнути світлу тему"
                    : "Увімкнути темну тему"
                }
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {theme === "dark"
                ? "Наступна: світла тема"
                : "Наступна: темна тема"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="icon"
                className="h-8 w-8 border-[var(--enver-accent)]/30 bg-[var(--enver-accent)] text-white hover:bg-[var(--enver-accent-hover)] md:hidden"
                aria-label="Швидка дія: ліди"
              >
                <Link href="/leads">+</Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Новий лід</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="sm"
                className="hidden border-[var(--enver-accent)]/30 bg-[var(--enver-accent)] text-xs font-semibold text-white hover:bg-[var(--enver-accent-hover)] md:inline-flex"
              >
                <Link href="/leads">+ Швидка дія</Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[14rem]">
              Перейти до створення або списку лідів
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground md:hidden"
                aria-label="Вийти з облікового запису"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Вийти з системи</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="hidden text-xs text-muted-foreground md:inline-flex"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Вийти
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Завершити сесію</TooltipContent>
          </Tooltip>

          <motion.div
            className="enver-interactive flex items-center gap-2 rounded-full border border-[var(--enver-border)] bg-[var(--enver-card)] px-2 py-1 text-xs"
            whileHover={reduceMotion ? undefined : { y: -1 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <div className="hidden flex-col leading-tight md:flex">
              <span className="font-medium">
                {session?.user?.name ?? "Користувач"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {session?.user?.email ?? ""}
                {session?.user?.role
                  ? ` · ${session.user.role}`
                  : ""}
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
}

function getTitleFromPath(pathname: string | null): string {
  if (!pathname) return "Дашборд";
  const segments = pathname.split("/").filter(Boolean);
  /** Маршрути `/crm/*` (хаби ERP) — показуємо зрозумілу назву замість «Crm». */
  if (segments[0] === "crm") {
    const crmHubTitles: Record<string, string> = {
      dashboard: "Дашборд CRM",
      finance: "Фінанси",
      procurement: "Закупівлі",
      production: "Виробництво",
      erp: "Командний центр ERP",
      automation: "Автоматизація",
      deal: "Замовлення",
      external: "Зовнішній доступ",
    };
    const hub = segments[1] ?? "";
    if (hub === "production" && segments[2] === "workshop") {
      return "Цеховий Канбан";
    }
    if (crmHubTitles[hub]) return crmHubTitles[hub];
    return "CRM";
  }
  const raw = segments[0] ?? "";
  if (!raw) return "Дашборд";
  const map: Record<string, string> = {
    dashboard: "Дашборд",
    leads: "Ліди",
    contacts: "Контакти",
    deals: "Замовлення",
    calendar: "Календар",
    inbox: "Вхідні",
    production: "Виробництво",
    handoff: "Передача",
    tasks: "Задачі",
    files: "Файли",
    orders: "Замовлення",
    products: "Продукти",
    warehouse: "Склад",
    library: "Бібліотека",
    reports: "Звіти",
    notifications: "Сповіщення",
    admin: "Адміністраторська панель",
    settings: "Налаштування",
    login: "Вхід",
    today: "Мій день",
  };
  return map[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

