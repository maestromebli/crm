"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  FileSignature,
  FileSpreadsheet,
  KanbanSquare,
  LayoutGrid,
  Ruler,
  ThumbsDown,
  Trophy,
  Zap,
} from "lucide-react";

import { cn } from "../../../../lib/utils";
import { DEAL_LIST_ROUTES } from "./deal-list-routes";

const ROUTE_ICONS: Record<string, typeof LayoutGrid> = {
  "/deals": LayoutGrid,
  "/deals/pipeline": KanbanSquare,
  "/deals/active": Zap,
  "/deals/waiting-measure": Ruler,
  "/deals/proposal": FileSpreadsheet,
  "/deals/negotiation": FileSignature,
  "/deals/won": Trophy,
  "/deals/lost": ThumbsDown,
  "/deals/archived": Archive,
};

type Props = {
  activeHref?: string;
};

export function DealsModuleNav({ activeHref }: Props) {
  const pathname = usePathname();
  const current = activeHref ?? pathname;

  return (
    <nav
      className="-mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]"
      aria-label="Розділи модуля замовлень"
    >
      {DEAL_LIST_ROUTES.map((r) => {
        const active =
          current === r.href ||
          current === `${r.href}/` ||
          (r.href === "/deals" &&
            (current === "/deals" || current === "/deals/"));
        const Icon = ROUTE_ICONS[r.href] ?? LayoutGrid;
        return (
          <Link
            key={r.href}
            href={r.href}
            title={r.description}
            className={cn(
              "flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
              active
                ? "border-[var(--enver-accent)] bg-[var(--enver-accent)] text-white shadow-sm shadow-[var(--enver-accent)]/25"
                : "border-[var(--enver-border)] bg-[var(--enver-card)]/90 text-[var(--enver-text-muted)] hover:border-[var(--enver-border-strong)] hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)]",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                active ? "text-white" : "opacity-80",
              )}
              strokeWidth={2}
              aria-hidden
            />
            {r.label}
          </Link>
        );
      })}
    </nav>
  );
}
