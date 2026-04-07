"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BadgePercent,
  BookMarked,
  Building2,
  Calculator,
  CalendarDays,
  Coins,
  Factory,
  FileText,
  GitCompareArrows,
  History,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Percent,
  PieChart,
  Table2,
  Target,
  Users,
  Wallet,
} from "lucide-react";

/** Статичні сегменти URL під `/crm/finance/*` (не id проєкту). */
export const FINANCE_STATIC_ROUTE_SEGMENTS = new Set([
  "registry",
  "payroll",
  "banking",
  "documents",
  "counterparties",
  "reconciliation",
  "vat",
  "payroll-taxes",
  "taxes",
  "cashflow",
  "statements",
  "period-close",
  "chart-of-accounts",
  "fixed-assets",
  "budgets",
  "compliance",
  "audit",
  "operational-entry",
]);

type NavLink = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
  hint?: string;
};

const GROUPS: { title: string; description: string; links: NavLink[] }[] = [
  {
    title: "Операції",
    description: "Щоденна робота з грошима та проєктами",
    links: [
      {
        href: "/crm/finance",
        label: "Огляд",
        icon: LayoutDashboard,
        match: (p) => p === "/crm/finance" || p === "/crm/finance/",
        hint: "KPI, транзакції, графік оплат, експорт.",
      },
      {
        href: "/crm/finance/registry",
        label: "Реєстр",
        icon: Table2,
        match: (p) => p.startsWith("/crm/finance/registry"),
        hint: "Усі об'єкти в одній таблиці.",
      },
      {
        href: "/crm/finance/operational-entry",
        label: "Операційний облік",
        shortLabel: "Оп. облік",
        icon: Calculator,
        match: (p) => p.startsWith("/crm/finance/operational-entry"),
        hint: "Швидка проводка: надходження, витрати, переказ.",
      },
      {
        href: "/crm/finance/payroll",
        label: "Зарплата",
        icon: Wallet,
        match: (p) => p.startsWith("/crm/finance/payroll") && !p.startsWith("/crm/finance/payroll-taxes"),
        hint: "Нарахування по проєктах.",
      },
      {
        href: "/crm/finance/banking",
        label: "Банки",
        icon: Building2,
        match: (p) => p.startsWith("/crm/finance/banking"),
        hint: "Інтеграції та виписки.",
      },
    ],
  },
  {
    title: "Документи",
    description: "Первинка та розрахунки з контрагентами",
    links: [
      {
        href: "/crm/finance/documents",
        label: "Первинка",
        icon: FileText,
        match: (p) => p.startsWith("/crm/finance/documents"),
        hint: "Рахунки, акти, накладні.",
      },
      {
        href: "/crm/finance/counterparties",
        label: "Контрагенти",
        icon: Users,
        match: (p) => p.startsWith("/crm/finance/counterparties"),
        hint: "Дебіторка / кредиторка.",
      },
      {
        href: "/crm/finance/reconciliation",
        label: "Звірка",
        icon: GitCompareArrows,
        match: (p) => p.startsWith("/crm/finance/reconciliation"),
        hint: "Банк vs облік.",
      },
    ],
  },
  {
    title: "Податки",
    description: "ПДВ, зарплатні утримання, інші збори",
    links: [
      {
        href: "/crm/finance/vat",
        label: "ПДВ",
        icon: Percent,
        match: (p) => p.startsWith("/crm/finance/vat"),
        hint: "Періоди та суми до сплати (оціночно).",
      },
      {
        href: "/crm/finance/payroll-taxes",
        label: "ЗП та ЄСВ",
        shortLabel: "ЗП / ЄСВ",
        icon: BadgePercent,
        match: (p) => p.startsWith("/crm/finance/payroll-taxes"),
        hint: "ПДФО, військовий, ЄСВ.",
      },
      {
        href: "/crm/finance/taxes",
        label: "Інші збори",
        icon: Coins,
        match: (p) => p.startsWith("/crm/finance/taxes"),
        hint: "ЄП та інші платежі.",
      },
    ],
  },
  {
    title: "Звітність",
    description: "ДДС, форми, закриття періоду",
    links: [
      {
        href: "/crm/finance/cashflow",
        label: "ДДС",
        icon: ArrowLeftRight,
        match: (p) => p.startsWith("/crm/finance/cashflow"),
        hint: "Рух грошових коштів.",
      },
      {
        href: "/crm/finance/statements",
        label: "Баланс / Звіт",
        shortLabel: "Звіти",
        icon: PieChart,
        match: (p) => p.startsWith("/crm/finance/statements"),
        hint: "Баланс та фінрезультат.",
      },
      {
        href: "/crm/finance/period-close",
        label: "Закриття",
        icon: ListChecks,
        match: (p) => p.startsWith("/crm/finance/period-close"),
        hint: "Чек-лист місяця.",
      },
    ],
  },
  {
    title: "Облік",
    description: "План рахунків, ОЗ, бюджети",
    links: [
      {
        href: "/crm/finance/chart-of-accounts",
        label: "План рахунків",
        shortLabel: "План",
        icon: BookMarked,
        match: (p) => p.startsWith("/crm/finance/chart-of-accounts"),
        hint: "Рахунки та сальдо.",
      },
      {
        href: "/crm/finance/fixed-assets",
        label: "ОЗ",
        icon: Factory,
        match: (p) => p.startsWith("/crm/finance/fixed-assets"),
        hint: "Основні засоби.",
      },
      {
        href: "/crm/finance/budgets",
        label: "Бюджети",
        icon: Target,
        match: (p) => p.startsWith("/crm/finance/budgets"),
        hint: "План vs факт.",
      },
    ],
  },
  {
    title: "Контроль",
    description: "Дедлайни та аудит",
    links: [
      {
        href: "/crm/finance/compliance",
        label: "Календар",
        icon: CalendarDays,
        match: (p) => p.startsWith("/crm/finance/compliance"),
        hint: "Строки звітності.",
      },
      {
        href: "/crm/finance/audit",
        label: "Журнал",
        icon: History,
        match: (p) => p.startsWith("/crm/finance/audit"),
        hint: "Дії користувачів.",
      },
    ],
  },
];

export function isFinanceProjectDetailPath(pathname: string): boolean {
  if (!pathname.startsWith("/crm/finance/")) return false;
  const rest = pathname.replace(/^\/crm\/finance\/?/, "");
  if (!rest) return false;
  const first = rest.split("/")[0];
  if (!first) return false;
  if (FINANCE_STATIC_ROUTE_SEGMENTS.has(first)) return false;
  return true;
}

export function FinanceModuleNav() {
  const pathname = usePathname() ?? "";
  const onProjectCard = isFinanceProjectDetailPath(pathname);
  const projectIdFromPath = useMemo(() => {
    if (!onProjectCard) return null;
    const rest = pathname.replace(/^\/crm\/finance\/?/, "");
    const first = rest.split("/")[0];
    return first || null;
  }, [pathname, onProjectCard]);

  return (
    <nav
      className="sticky top-0 z-20 border-b border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-50/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-slate-50/85"
      aria-label="Підрозділи фінансів"
    >
      <div className="border-b border-slate-100/80 bg-[var(--enver-card)]/40 px-3 py-2.5 sm:px-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Модуль</p>
            <p className="truncate text-sm font-semibold text-slate-800">Фінанси та облік</p>
          </div>
          <p className="hidden max-w-md text-[11px] leading-snug text-slate-500 md:block">
            Оберіть розділ: операції → документи → податки → звітність → облік → контроль.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-3">
        <div className="flex gap-2.5 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
          {GROUPS.map((g) => (
            <div
              key={g.title}
              className="flex w-[min(100%,260px)] shrink-0 flex-col rounded-xl border border-slate-200/90 bg-[var(--enver-card)]/90 p-2 shadow-sm ring-1 ring-slate-900/[0.03] sm:w-[220px]"
            >
              <div className="mb-1.5 border-b border-slate-100 pb-1.5">
                <p className="text-[11px] font-bold text-slate-800">{g.title}</p>
                <p className="text-[10px] leading-tight text-slate-500">{g.description}</p>
              </div>
              <div className="flex flex-col gap-0.5">
                {g.links.map(({ href, label, shortLabel, icon: Icon, match, hint }) => {
                  const active = match(pathname);
                  const text = shortLabel ?? label;
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={hint}
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                        active
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-700 hover:bg-slate-100 hover:text-[var(--enver-text)]"
                      }`}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 opacity-90 ${active ? "text-white" : "text-slate-500 group-hover:text-slate-700"}`}
                        aria-hidden
                      />
                      <span className="truncate">{text}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {onProjectCard && projectIdFromPath ? (
        <div className="border-t border-slate-200/80 bg-amber-50/50 px-3 py-2.5 sm:px-4">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-amber-950">
              <Landmark className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              <span>
                Відкрито <strong>картку проєкту</strong> — тут лише цей об’єкт; поверніться до огляду для портфеля.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/crm/finance"
                className="inline-flex items-center rounded-lg border border-slate-200 bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-[var(--enver-hover)]"
              >
                ← До огляду
              </Link>
              <Link
                href={`/crm/procurement/${projectIdFromPath}`}
                className="inline-flex items-center rounded-lg border border-amber-200 bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-amber-950 shadow-sm transition hover:bg-amber-50/80"
              >
                Закупівлі проєкту
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
