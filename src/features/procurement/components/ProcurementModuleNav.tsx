"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Швидкі переходи між закупівлями та фінансами (узгоджено з FinanceModuleNav). */
const LINKS = [
  {
    href: "/crm/procurement",
    label: "Закупівлі",
    match: (p: string) => p.startsWith("/crm/procurement"),
    hint: "Заявки, позиції, PO та поставки по всіх проєктах.",
  },
  {
    href: "/crm/finance",
    label: "Фінанси",
    match: (p: string) => p.startsWith("/crm/finance"),
    hint: "Портфель, грошовий рух, реєстр та податкові розділи.",
  },
] as const;

export function ProcurementModuleNav() {
  const pathname = usePathname() ?? "";
  const procurementProjectId = useMemo(() => {
    if (!pathname.startsWith("/crm/procurement/")) return null;
    const rest = pathname.replace(/^\/crm\/procurement\/?/, "");
    const first = rest.split("/")[0];
    if (!first) return null;
    return first;
  }, [pathname]);
  const onProjectCard = Boolean(procurementProjectId);

  return (
    <nav
      className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-slate-50/80"
      aria-label="Підрозділи закупівель та звʼязок з фінансами"
    >
      <div className="flex flex-wrap gap-1">
        {LINKS.map(({ href, label, match, hint }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              title={hint}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                active
                  ? "bg-[var(--enver-card)] text-[var(--enver-text)] shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-[var(--enver-card)]/80 hover:text-[var(--enver-text)]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
      {onProjectCard && procurementProjectId ? (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 pt-2">
          <span className="rounded-md border border-dashed border-slate-300 bg-[var(--enver-card)]/90 px-2 py-1 text-[11px] text-slate-600">
            Проєкт
          </span>
          <Link
            href="/crm/procurement"
            title="Загальний список закупівель по всіх об'єктах"
            className="rounded-md border border-slate-200 bg-[var(--enver-card)] px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-[var(--enver-hover)]"
          >
            ← Огляд закупівель
          </Link>
          <Link
            href={`/crm/finance/${procurementProjectId}`}
            title="Транзакції, план оплат і маржа тільки для цього проєкту"
            className="rounded-md border border-slate-200 bg-[var(--enver-card)] px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-[var(--enver-hover)]"
          >
            Фінанси проєкту
          </Link>
        </div>
      ) : null}
    </nav>
  );
}
