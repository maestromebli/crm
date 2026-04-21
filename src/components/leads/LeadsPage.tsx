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
  canCreateLead?: boolean;
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
  canCreateLead = true,
  kpiCounts,
  showKpiStrip = false,
}: LeadsPageProps) {
  const showSourceGroups = view === "sources";
  const stagger = (index: number) => ({
    animationDelay: `${Math.min(index, 8) * 45}ms`,
  });

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-[var(--enver-bg)] px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-4">
        <header
          className="enver-card-appear flex flex-col gap-4 rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5"
          style={stagger(0)}
        >
          <div className="flex gap-3">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--enver-surface)] text-[var(--enver-text-muted)] sm:flex">
              <Users className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="enver-status-chip w-fit">
                Модуль · Ліди
              </p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-[var(--enver-text)] md:text-xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--enver-text-muted)] md:text-sm">
                  {description}
                </p>
              ) : (
                <p className="mt-1 max-w-2xl text-xs text-[var(--enver-text-muted)]">
                  Усі звернення до замовлення — в одному місці: контакт, кроки, файли та
                  конверсія.
                </p>
              )}
            </div>
          </div>
          <LeadsToolbar
            view={view}
            canUploadLeadFiles={canUploadLeadFiles}
            canCreateLead={canCreateLead}
          />
        </header>

        <div className="enver-card-appear" style={stagger(1)}>
          <LeadFilters />
        </div>

        {showKpiStrip && kpiCounts ? (
          <div className="enver-card-appear" style={stagger(2)}>
            <LeadsKpiStrip counts={kpiCounts} />
          </div>
        ) : null}

        {hint ? (
          <div
            className="enver-card-appear rounded-xl border border-[var(--enver-warning)]/30 bg-[var(--enver-warning-soft)] px-3 py-2 text-xs text-[var(--enver-warning)]"
            style={stagger(3)}
          >
            {hint}
          </div>
        ) : null}

        {rows.length === 0 && !hint ? (
          <div
            className="enver-card-appear rounded-2xl border border-dashed border-[var(--enver-border)] bg-[var(--enver-card)] px-4 py-12 text-center shadow-sm"
            style={stagger(4)}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--enver-surface)] text-[var(--enver-muted)]">
              <Users className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            </div>
            <p className="mt-4 text-sm font-medium text-[var(--enver-text)]">
              Поки немає лідів у цьому вигляді
            </p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[var(--enver-text-muted)]">
              {canCreateLead
                ? "Натисніть «Новий лід» угорі справа або змініть фільтр черги — список оновиться автоматично."
                : "У вас немає прав на створення лідів. Змініть фільтр черги або зверніться до адміністратора."}
            </p>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="enver-card-appear" style={stagger(4)}>
            <LeadsList rows={rows} groupBySource={showSourceGroups} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
