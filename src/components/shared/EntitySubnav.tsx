"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Briefcase,
  Calculator,
  Calendar,
  CheckSquare,
  FolderOpen,
  History,
  LayoutDashboard,
  MessageSquare,
  Package,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { ENTITY_TABS, type EntityKind } from "../../config/entityTabs";
import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import { canViewDealWorkspaceTab } from "../../lib/deal-workspace-visibility";
import { cn } from "../../lib/utils";

const LEAD_TAB_ICONS: Record<string, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  pricing: Calculator,
  messages: MessageSquare,
  contact: User,
  tasks: CheckSquare,
  files: FolderOpen,
  activity: History,
  ai: Sparkles,
};

const DEAL_TAB_ICONS: Record<string, typeof LayoutDashboard> = {
  workspace: LayoutDashboard,
  contacts: Users,
  calendar: Calendar,
  tasks: CheckSquare,
  files: FolderOpen,
  handoff: Package,
  activity: History,
};

const CONTACT_TAB_ICONS: Record<string, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  deals: Briefcase,
  conversations: MessageSquare,
  files: FolderOpen,
  tasks: CheckSquare,
  activity: History,
};

function tabFromWorkspaceHref(href: string): string {
  try {
    const u = new URL(href, "http://local");
    return u.searchParams.get("tab")?.trim() || "overview";
  } catch {
    return "overview";
  }
}

type EntitySubnavProps = {
  entityId: string;
  kind: EntityKind;
  /** id вкладок, які приховати для конкретної сутності. */
  hiddenTabIds?: string[];
};

function EntitySubnavDeal({ entityId }: { entityId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const { data } = useSession();
  const keys = data?.user?.permissionKeys ?? [];
  const realRole = data?.user?.realRole;
  const impersonatorId = data?.user?.impersonatorId;
  const toWorkspaceTab = (tabId: string): DealWorkspaceTabId => {
    if (tabId === "workspace") return "overview";
    if (tabId === "contacts") return "messages";
    if (tabId === "calendar") return "measurement";
    return tabId as DealWorkspaceTabId;
  };
  const tabs = ENTITY_TABS.deal.filter((tab) => {
    return canViewDealWorkspaceTab(toWorkspaceTab(tab.id), {
      permissionKeys: keys,
      realRole,
      impersonatorId,
    });
  });
  const workspacePath = `/deals/${entityId}/workspace`;
  const currentTab =
    searchParams.get("tab")?.trim() || "overview";

  return (
    <div className="border-b border-[var(--enver-border)] bg-[var(--enver-bg)]">
      <div className="mx-auto max-w-7xl px-3 pt-1 md:px-6">
        <p className="mb-1 hidden text-[10px] font-medium uppercase tracking-wide text-[var(--enver-muted)] sm:block">
          Розділ угоди
        </p>
        <nav
          className="-mx-1 flex gap-0.5 overflow-x-auto pb-0 pt-0.5 [scrollbar-width:thin]"
          aria-label="Вкладки картки"
        >
          {tabs.map((tab) => {
            const href = tab.href(entityId);
            const expectedTab = tabFromWorkspaceHref(href);
            const onWorkspace =
              pathname === workspacePath || pathname === `${workspacePath}/`;
            const active =
              onWorkspace && expectedTab === currentTab;
            const accent = tab.style === "accentPill";
            const Icon = DEAL_TAB_ICONS[tab.id] ?? LayoutDashboard;

            return (
              <Link
                key={tab.id}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "enver-interactive relative flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
                  accent
                    ? active
                      ? "border-[#2563eb] text-[var(--enver-accent)]"
                      : "border-transparent text-[var(--enver-accent)] hover:bg-[var(--enver-hover)]"
                    : active
                      ? "border-[#2563EB] text-[var(--enver-text)]"
                      : "border-transparent text-[var(--enver-muted)] hover:border-[var(--enver-border)] hover:bg-[var(--enver-card)] hover:text-[var(--enver-text)]",
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    accent && !active && "opacity-90",
                  )}
                  strokeWidth={2}
                  aria-hidden
                />
                {active && !reduceMotion ? (
                  <motion.span
                    layoutId="entity-subnav-deal-indicator"
                    className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--enver-accent)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function EntitySubnav({
  entityId,
  kind,
  hiddenTabIds,
}: EntitySubnavProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (kind === "deal") {
    return <EntitySubnavDeal entityId={entityId} />;
  }

  const hidden = new Set(hiddenTabIds ?? []);
  const tabs =
    kind === "lead"
      ? ENTITY_TABS[kind].filter((t) => !hidden.has(t.id))
      : ENTITY_TABS[kind];
  const leadBase = kind === "lead" ? `/leads/${entityId}` : "";
  const contactBase = kind === "contact" ? `/contacts/${entityId}` : "";

  return (
    <div className="border-b border-[var(--enver-border)] bg-[var(--enver-bg)]">
      <div className="mx-auto max-w-7xl px-3 pt-1 md:px-6">
        <p className="mb-1 hidden text-[10px] font-medium uppercase tracking-wide text-[var(--enver-muted)] sm:block">
          {kind === "lead"
            ? "Розділ картки"
            : kind === "contact"
              ? "Розділ контакту"
              : "Навігація"}
        </p>
        <nav
          className="-mx-1 flex gap-0 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]"
          aria-label="Вкладки картки"
        >
          {tabs.map((tab, index) => {
            const href = tab.href(entityId);
            const onLeadHub =
              kind === "lead" &&
              tab.id === "overview" &&
              (pathname === leadBase ||
                pathname === `${leadBase}/` ||
                pathname === `${leadBase}/overview`);
            const onContactOverview =
              kind === "contact" &&
              tab.id === "overview" &&
              (pathname === contactBase || pathname === `${contactBase}/`);
            const active =
              onLeadHub || onContactOverview || pathname === href;
            const accent = tab.style === "accentPill";
            const leadSegmented = kind === "lead" && !accent;
            const Icon =
              kind === "lead"
                ? LEAD_TAB_ICONS[tab.id] ?? LayoutDashboard
                : kind === "contact"
                  ? CONTACT_TAB_ICONS[tab.id] ?? LayoutDashboard
                  : null;

            return (
              <Link
                key={tab.id}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "enver-interactive relative flex h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-2 text-xs font-medium transition-all duration-200",
                  leadSegmented
                    ? active
                      ? "border border-[#d8e3e8] bg-[#f7fbfc] text-emerald-700 shadow-[0_1px_0_rgba(255,255,255,0.85),0_8px_18px_rgba(15,23,42,0.08)]"
                      : "border border-emerald-500/75 bg-gradient-to-b from-emerald-400 to-emerald-500 text-emerald-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-105"
                    : accent
                    ? active
                      ? "border-[#2563eb] bg-[var(--enver-card)] text-[var(--enver-accent)]"
                      : "border-transparent text-[var(--enver-accent)] hover:bg-[var(--enver-hover)]"
                    : active
                      ? "border-[var(--enver-border)] bg-[var(--enver-card)] text-[var(--enver-text)] shadow-[0_6px_12px_rgba(15,23,42,0.08)]"
                      : "border-transparent text-[var(--enver-muted)] hover:border-[var(--enver-border)] hover:bg-[var(--enver-card)] hover:text-[var(--enver-text)]",
                  leadSegmented &&
                    "-ml-1.5 [clip-path:polygon(12px_0,calc(100%-12px)_0,100%_100%,0_100%)] first:ml-0 first:[clip-path:polygon(0_0,calc(100%-12px)_0,100%_100%,0_100%)]",
                )}
              >
                <span className="relative z-10 flex items-center gap-1.5">
                  {Icon ? (
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        accent && !active && "opacity-90",
                      )}
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : null}
                  {tab.label}
                </span>
                {active && !reduceMotion && !leadSegmented ? (
                  <motion.span
                    layoutId={`entity-subnav-${kind}-indicator`}
                    className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--enver-accent)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
