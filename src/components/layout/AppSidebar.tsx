"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { hasEffectivePermission, P } from "../../lib/authz/permissions";
import { NAV_SECTIONS, type NavSection } from "../../config/navigation";
import { filterNavSubItemsForUser } from "../../lib/navigation-access";
import styles from "./AppSidebar.module.css";
import { tryReadResponseJson } from "@/lib/http/read-response-json";

type AppSidebarProps = {
  className?: string;
  /** У мобільному Sheet — variant drawer. */
  variant?: "default" | "drawer";
  compact?: boolean;
};

export function AppSidebar({
  className,
  variant = "default",
  compact = false,
}: AppSidebarProps = {}) {
  const pathname = usePathname();
  const { data } = useSession();
  const [alertsUnread, setAlertsUnread] = useState(0);
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null);
  /** Акордеон: одна відкрита група; червінь синхронізується з маршрутом. */
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const keys = useMemo(
    () => data?.user?.permissionKeys ?? [],
    [data?.user?.permissionKeys],
  );
  const realRole = data?.user?.realRole;
  const impersonatorId = data?.user?.impersonatorId;
  const menuAccess = data?.user?.menuAccess ?? null;
  const canViewAlerts = Boolean(
    data?.user?.permissionKeys?.includes("NOTIFICATIONS_VIEW"),
  );

  const sections = useMemo(() => {
    const canSeeSection = (s: NavSection) => {
      const ctx = { realRole, impersonatorId };
      if (s.id === "finance") {
        return [P.REPORTS_VIEW, P.MARGIN_VIEW, P.COST_VIEW, P.PAYMENTS_VIEW].some(
          (perm) => hasEffectivePermission(keys, perm, ctx),
        );
      }
      if (s.id === "production") {
        return [
          P.PRODUCTION_LAUNCH,
          P.PRODUCTION_ORDERS_VIEW,
          P.PRODUCTION_ORDERS_MANAGE,
          P.DEALS_VIEW,
        ].some((perm) => hasEffectivePermission(keys, perm, ctx));
      }
      if (s.id === "procurement") {
        return [P.COST_VIEW, P.MARGIN_VIEW, P.PAYMENTS_VIEW, P.REPORTS_VIEW].some(
          (perm) => hasEffectivePermission(keys, perm, ctx),
        );
      }
      if (!s.permission) return true;
      return hasEffectivePermission(keys, s.permission, ctx);
    };

    const out: NavSection[] = [];
    for (const s of NAV_SECTIONS) {
      if (!canSeeSection(s)) {
        continue;
      }
      if (!s.subItems?.length) {
        out.push(s);
        continue;
      }
      const subs = filterNavSubItemsForUser(s.id, s.subItems, menuAccess);
      if (subs.length === 0) continue;
      out.push({ ...s, subItems: subs });
    }
    return out;
  }, [keys, realRole, impersonatorId, menuAccess]);

  useLayoutEffect(() => {
    if (compact) return;
    for (const s of sections) {
      if (!s.subItems?.length) continue;
      const hasActiveSub =
        s.subItems.some(
          (sub) =>
            pathname === sub.href || pathname.startsWith(`${sub.href}/`),
        ) ?? false;
      const parentActive =
        pathname === s.href || pathname.startsWith(`${s.href}/`);
      if (hasActiveSub || parentActive) {
        setOpenSectionId(s.id);
        return;
      }
    }
  }, [compact, pathname, sections]);

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
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const openHoverPopover = (sectionId: string) => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setHoveredSectionId(sectionId);
  };

  const scheduleCloseHoverPopover = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setHoveredSectionId(null);
      closeTimerRef.current = null;
    }, 180);
  };

  const closeHoverPopoverNow = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setHoveredSectionId(null);
  };

  const toggleAccordion = (sectionId: string) => {
    setOpenSectionId((prev) => (prev === sectionId ? null : sectionId));
  };

  return (
    <aside
      className={cn(
        styles.aside,
        "relative flex flex-col border-r border-[var(--enver-border)] shadow-[0_1px_0_rgba(0,0,0,0.04)]",
        compact && variant === "default"
          ? "overflow-visible"
          : variant === "drawer"
            ? "overflow-hidden"
            : "overflow-visible",
        variant === "drawer"
          ? "h-full min-h-0 w-full"
          : compact
            ? "min-h-screen w-16 self-stretch"
            : "min-h-screen w-80 self-stretch",
        className,
      )}
    >
      <div
        className={cn(
          "relative z-10 flex min-h-full flex-col py-5 antialiased",
          compact ? "px-2" : "px-3.5",
        )}
      >
        <div
          className={cn(
            "mb-6 flex w-full min-w-0 items-center",
            compact ? "justify-center px-0" : "justify-start px-0",
          )}
        >
          <Link
            href="/crm/dashboard"
            title="ENVER CRM · CRM-ERP SYSTEM"
            className={cn(
              "relative block min-w-0 shrink-0",
              compact ? "h-[1.6rem] w-8" : "w-[80%]",
            )}
          >
            <Image
              src="/enver-logo.png"
              alt="ENVER CRM · CRM-ERP SYSTEM"
              width={1696}
              height={604}
              className={
                compact
                  ? "bg-transparent h-full w-full object-cover object-left"
                  : "bg-transparent h-auto w-full max-w-full object-contain object-left"
              }
              sizes={compact ? "32px" : "240px"}
              priority
            />
          </Link>
        </div>

        <nav
          className="flex-1 min-h-0 space-y-3 overflow-visible pr-1 text-sm leading-snug"
          aria-label="Головне меню"
        >
        {sections.map((section) => {
          const popoverId = `sidebar-popover-${section.id}`;
          const linkId = `sidebar-link-${section.id}`;
          const hasActiveSub =
            section.subItems?.some((sub) => pathname === sub.href) ?? false;
          const isActive =
            pathname === section.href ||
            pathname.startsWith(`${section.href}/`) ||
            hasActiveSub;
          const Icon = section.icon;
          const hasSubmenu = Boolean(section.subItems?.length);
          const accordionOpen = !compact && hasSubmenu && openSectionId === section.id;

          return (
            <div
              key={section.id}
              className={cn(styles.navRow, compact && "relative")}
              onMouseEnter={compact ? () => openHoverPopover(section.id) : undefined}
              onMouseLeave={compact ? scheduleCloseHoverPopover : undefined}
              onFocus={compact ? () => openHoverPopover(section.id) : undefined}
              onBlur={
                compact
                  ? (e) => {
                      const next = e.relatedTarget as Node | null;
                      if (!next || !e.currentTarget.contains(next)) {
                        scheduleCloseHoverPopover();
                      }
                    }
                  : undefined
              }
              onKeyDown={
                compact
                  ? (e) => {
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        closeHoverPopoverNow();
                        (e.currentTarget.querySelector("a") as HTMLAnchorElement | null)?.focus();
                      }
                    }
                  : undefined
              }
            >
              <div
                className={cn(
                  !compact && hasSubmenu && "flex items-stretch gap-0.5",
                )}
              >
                <Link
                  href={section.href}
                  id={compact ? linkId : undefined}
                  aria-expanded={
                    compact
                      ? hoveredSectionId === section.id
                      : hasSubmenu
                        ? accordionOpen
                        : undefined
                  }
                  aria-controls={
                    compact && section.subItems?.length ? popoverId : undefined
                  }
                  aria-haspopup={
                    compact && section.subItems?.length ? "menu" : undefined
                  }
                  className={cn(
                    styles.navLink,
                    "flex min-w-0 flex-1 items-center rounded-[12px] py-2 transition-[background-color] duration-200 ease-out",
                    compact
                      ? "justify-center px-2 hover:bg-[var(--enver-hover)]"
                      : "gap-3 px-2 hover:bg-[var(--enver-hover)]",
                    !compact &&
                      "group/main [&:focus-visible]:outline [&:focus-visible]:outline-2 [&:focus-visible]:outline-offset-2 [&:focus-visible]:outline-[var(--enver-accent)]/40",
                    isActive &&
                      "bg-[var(--enver-accent-soft)] font-semibold text-[var(--enver-accent-hover)] ring-1 ring-[var(--enver-accent-ring)]",
                  )}
                  title={compact ? section.label : undefined}
                >
                  <span
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-[12px] text-[var(--enver-text-muted)] ring-1 ring-[var(--enver-border-strong)]",
                      compact ? "h-9 w-9" : "h-9 w-9 bg-[var(--enver-bg)]",
                      isActive && "bg-[var(--enver-card)] text-[var(--enver-accent)] ring-[var(--enver-accent-ring)]",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {!compact ? (
                    <span className="min-w-0 flex-1 truncate text-left">
                      {section.label}
                    </span>
                  ) : null}
                  {!compact && section.id === "inbox" && alertsUnread > 0 ? (
                    <span className="ml-auto inline-flex min-w-[1.2rem] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {alertsUnread > 99 ? "99+" : alertsUnread}
                    </span>
                  ) : null}
                </Link>
                {!compact && hasSubmenu ? (
                  <button
                    type="button"
                    className={cn(
                      "flex w-9 shrink-0 items-center justify-center rounded-[12px] text-[var(--enver-muted)] transition-colors hover:bg-[var(--enver-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--enver-accent)]/40",
                      accordionOpen && "bg-[var(--enver-surface)]",
                    )}
                    aria-expanded={accordionOpen}
                    aria-controls={`submenu-${section.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleAccordion(section.id);
                    }}
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        accordionOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                    <span className="sr-only">
                      {accordionOpen ? "Згорнути" : "Розгорнути"} підменю:{" "}
                      {section.label}
                    </span>
                  </button>
                ) : null}
              </div>
              {compact && section.subItems?.length ? (
                <div
                  id={popoverId}
                  role="menu"
                  aria-labelledby={linkId}
                  className={cn(
                    "absolute left-[calc(100%+8px)] top-0 z-40 min-w-56 rounded-lg border border-slate-600/60 bg-[var(--enver-card)] p-2 text-[var(--enver-text)] shadow-xl transition-[opacity,transform,visibility] duration-200 ease-out",
                    hoveredSectionId === section.id
                      ? "pointer-events-auto visible translate-x-0 scale-100 opacity-100"
                      : "pointer-events-none invisible -translate-x-1 scale-[0.98] opacity-0",
                  )}
                >
                  <div className="px-2 pb-1 text-xs font-semibold text-[var(--enver-text)]">
                    {section.label}
                  </div>
                  <div className="space-y-0.5">
                    {section.subItems.map((sub) => {
                      const subActive = pathname === sub.href;
                      return (
                        <Link
                          key={sub.id}
                          href={sub.href}
                          role="menuitem"
                          className={cn(
                            "flex items-center rounded-[12px] px-2 py-1.5 text-xs transition-colors hover:bg-[var(--enver-hover)]",
                            subActive && "bg-[var(--enver-accent-soft)] font-semibold text-[var(--enver-accent-hover)]",
                          )}
                        >
                          <span className="truncate">{sub.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {!compact && hasSubmenu && accordionOpen ? (
                <ul
                  id={`submenu-${section.id}`}
                  className="mt-2 space-y-0.5 border-l border-[var(--enver-border)] pl-3"
                  role="list"
                >
                  {section.subItems!.map((sub) => {
                    const subActive = pathname === sub.href;
                    return (
                      <li key={sub.id}>
                        <Link
                          href={sub.href}
                          className={cn(
                            styles.navLinkMuted,
                            "flex items-center justify-between rounded-[12px] px-2.5 py-2 transition-colors duration-200 ease-out hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)]",
                            subActive &&
                              "bg-[var(--enver-accent-soft)] font-medium !text-[var(--enver-accent-hover)] ring-1 ring-[var(--enver-accent-ring)]",
                          )}
                        >
                          <span className="truncate">{sub.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
        </nav>
      </div>
    </aside>
  );
}
