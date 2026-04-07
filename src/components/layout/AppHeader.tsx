"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { AlertTriangle, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
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

export function AppHeader({
  sidebarCompact = false,
  onToggleSidebar,
}: AppHeaderProps = {}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  /** Radix Sheet генерує aria-controls на клієнті; SSR дає інші id → гідратаційний розрив без defer. */
  const [mobileNavMounted, setMobileNavMounted] = useState(false);
  const [alertsUnread, setAlertsUnread] = useState(0);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const canViewAlerts = Boolean(
    session?.user?.permissionKeys?.includes("NOTIFICATIONS_VIEW"),
  );

  const userInitials = initialsFromName(session?.user?.name, session?.user?.email);

  const title = getTitleFromPath(pathname);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
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
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [canViewAlerts]);

  useEffect(() => {
    setMobileNavMounted(true);
  }, []);

  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between gap-3 border-b border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 shadow-[var(--enver-shadow)] md:px-6",
        commandPaletteOpen && "relative z-[100]",
      )}
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
          <span className="text-[11px] text-[var(--enver-muted)]">
            ENVER CRM · операційний простір
          </span>
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
                asChild
                size="icon"
                className="h-8 w-8 border-[var(--enver-accent)]/40 bg-[var(--enver-accent)] text-white shadow-md shadow-[var(--enver-accent)]/20 hover:brightness-110 md:hidden"
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
                className="hidden border-[var(--enver-accent)]/40 bg-[var(--enver-accent)] text-xs font-semibold text-white shadow-md shadow-[var(--enver-accent)]/20 hover:brightness-110 md:inline-flex"
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

          <div className="flex items-center gap-2 rounded-full border border-[var(--enver-border)] bg-[var(--enver-card)] px-2 py-1 text-xs shadow-[var(--enver-shadow)]">
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
          </div>
        </div>
      </div>
    </header>
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
      erp: "ERP Command Center",
      automation: "Автоматизація",
      deal: "Угода",
      external: "Зовнішній доступ",
    };
    const hub = segments[1] ?? "";
    if (hub === "production" && segments[2] === "workshop") {
      return "Цеховий Kanban";
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
    deals: "Угоди",
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

