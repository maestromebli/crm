"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Briefcase,
  Calculator,
  Calendar,
  CheckSquare,
  FileText,
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
import { cn } from "../../lib/utils";

const LEAD_TAB_ICONS: Record<string, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  pricing: Calculator,
  kp: FileText,
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
  /** id вкладок lead, які приховати (наприклад `pricing` без доступу до смет). */
  leadHiddenTabIds?: string[];
};

function EntitySubnavDeal({ entityId }: { entityId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabs = ENTITY_TABS.deal;
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
          className="-mx-1 flex gap-0 overflow-x-auto pb-0 pt-0.5 [scrollbar-width:thin]"
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
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
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
  leadHiddenTabIds,
}: EntitySubnavProps) {
  const pathname = usePathname();

  if (kind === "deal") {
    return <EntitySubnavDeal entityId={entityId} />;
  }

  const hidden = new Set(leadHiddenTabIds ?? []);
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
          className="-mx-1 flex gap-0 overflow-x-auto pb-0 pt-0.5 [scrollbar-width:thin]"
          aria-label="Вкладки картки"
        >
          {tabs.map((tab) => {
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
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
                  accent
                    ? active
                      ? "border-[#2563eb] text-[var(--enver-accent)]"
                      : "border-transparent text-[var(--enver-accent)] hover:bg-[var(--enver-hover)]"
                    : active
                      ? "border-[#2563EB] text-[var(--enver-text)]"
                      : "border-transparent text-[var(--enver-muted)] hover:border-[var(--enver-border)] hover:bg-[var(--enver-card)] hover:text-[var(--enver-text)]",
                )}
              >
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
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
