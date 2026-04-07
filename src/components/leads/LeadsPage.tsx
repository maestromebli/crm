import { Users } from "lucide-react";
import type { LeadKpiCounts, LeadListRow } from "../../features/leads/queries";
import { LeadFilters } from "./LeadFilters";
import { LeadsKpiStrip } from "./LeadsKpiStrip";
import { LeadsList } from "./LeadsList";
import { LeadsToolbar } from "./LeadsToolbar";

export type LeadsPageProps = {
  title: string;
  description?: string;
  view: string;
  rows: LeadListRow[];
  hint: string | null;
  canUploadLeadFiles?: boolean;
  kpiCounts?: LeadKpiCounts | null;
  showKpiStrip?: boolean;
};

export function LeadsPage({
  title,
  description,
  view,
  rows,
  hint,
  canUploadLeadFiles = true,
  kpiCounts,
  showKpiStrip = false,
}: LeadsPageProps) {
  const showSourceGroups = view === "sources";

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-slate-50 px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-4">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/90 px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between md:px-5">
          <div className="flex gap-3">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white sm:flex">
              <Users className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Модуль · Ліди
              </p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-[var(--enver-text)] md:text-xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600 md:text-sm">
                  {description}
                </p>
              ) : (
                <p className="mt-1 max-w-2xl text-xs text-slate-500">
                  Усі звернення до угоди — в одному місці: контакт, кроки, файли та
                  конверсія.
                </p>
              )}
            </div>
          </div>
          <LeadsToolbar
            view={view}
            canUploadLeadFiles={canUploadLeadFiles}
          />
        </header>

        <LeadFilters />

        {showKpiStrip && kpiCounts ? (
          <LeadsKpiStrip counts={kpiCounts} />
        ) : null}

        {hint ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {hint}
          </div>
        ) : null}

        {rows.length === 0 && !hint ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-[var(--enver-card)] px-4 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Users className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-800">
              Поки немає лідів у цьому вигляді
            </p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
              Натисніть «Новий лід» угорі справа або змініть фільтр черги — список
              оновиться автоматично.
            </p>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <LeadsList rows={rows} groupBySource={showSourceGroups} />
        ) : null}
      </div>
    </div>
  );
}
