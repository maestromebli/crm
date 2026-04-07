"use client";

import { Suspense } from "react";
import type { EffectiveRole } from "../../lib/authz/roles";
import type { ExecutiveDashboardPerms } from "../dashboard/queries";
import type { ExecutiveDashboardPayload } from "./executive-types";
import { buildExecutiveDashboardAiContext } from "../../lib/ai/executive-dashboard-ai-context";
import { DashboardShell } from "./components/dashboard-shell";
import { FinanceRangeTabs } from "./components/finance-range-tabs";
import { FilterBar } from "./components/filter-bar";
import { KpiCard } from "./components/kpi-card";
import { FunnelCard } from "./components/funnel-card";
import { RevenueTrendCard } from "./components/revenue-trend-card";
import { CashflowCard } from "./components/cashflow-card";
import { NextBestActionsCard } from "./components/next-best-actions-card";
import { RiskCenterCard } from "./components/risk-center-card";
import { TeamPerformanceCard } from "./components/team-performance-card";
import { FinanceOverviewCard } from "./components/finance-overview-card";
import { ProductionOverviewCard } from "./components/production-overview-card";
import { ProcurementOverviewCard } from "./components/procurement-overview-card";
import { ScheduleWidget } from "./components/schedule-widget";
import { DirectorAiPanel } from "./components/director-ai-panel";
import { BehaviorEngineCard } from "./components/behavior-engine-card";
import { DailyOperatingCard } from "./components/daily-operating-card";
import { DashboardRealtimePill } from "../realtime/dashboard-realtime-pill";

export type ExecutiveDashboardViewProps = {
  role: EffectiveRole;
  perms: ExecutiveDashboardPerms;
  data: ExecutiveDashboardPayload;
};

function FinanceRangeTabsSuspense() {
  return (
    <Suspense fallback={<div className="h-9 w-full max-w-md animate-pulse rounded-xl bg-[var(--enver-surface)]" />}>
      <FinanceRangeTabs />
    </Suspense>
  );
}

export function ExecutiveDashboardView({
  role,
  perms,
  data,
}: ExecutiveDashboardViewProps) {
  const aiContext = buildExecutiveDashboardAiContext(data);
  const subtitle =
    data.layout === "measurer"
      ? "Розклад замірів та задачі — швидкий контроль якості виїздів."
      : data.layout === "sales"
        ? "Ваш персональний контури продажів, оплат і задач."
        : data.layout === "team_lead"
          ? "Командні продажі, виробництво та ризики в одному вікні."
          : "Повний операційний та фінансовий зріз ENVER в одному екрані.";

  if (data.error) {
    return (
      <DashboardShell
        title="Дашборд"
        subtitle={data.error}
        controls={<FinanceRangeTabsSuspense />}
      >
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-rose-900">
          <p className="font-medium">Помилка даних</p>
          <p className="mt-1 text-sm">{data.error}</p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-rose-800 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => window.location.reload()}
          >
            Повторити
          </button>
        </div>
      </DashboardShell>
    );
  }

  if (data.layout === "measurer") {
    return (
      <DashboardShell
        title="Розклад замірів"
        subtitle={subtitle}
        controls={<FinanceRangeTabsSuspense />}
      >
        <Suspense>
          <FilterBar />
        </Suspense>
        <div className="grid gap-6 lg:grid-cols-2">
          {data.schedule ? <ScheduleWidget data={data.schedule} /> : null}
          <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 text-sm text-[var(--enver-text-muted)]">
            Детальний графік і призначення — у календарі. Для замірів
            зосередьтесь на найближчій події та прострочених задачах.
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Контроль-центр директора"
      subtitle={subtitle}
      controls={
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <FinanceRangeTabsSuspense />
          <DashboardRealtimePill />
          <span className="hidden text-[11px] text-[var(--enver-muted)] sm:inline">
            {role}
          </span>
        </div>
      }
    >
      <Suspense fallback={<div className="h-16 animate-pulse rounded-2xl bg-[var(--enver-surface)]" />}>
        <FilterBar />
      </Suspense>

      {data.kpis.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {data.kpis.map((k) => (
            <KpiCard key={k.id} kpi={k} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--enver-border)] bg-[var(--enver-surface)]/50 px-4 py-8 text-center text-sm text-[var(--enver-text-muted)]">
          Немає KPI для вашої ролі або обмежень доступу.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7 2xl:col-span-8">
          {perms.leadsView ? <FunnelCard stages={data.funnel} /> : null}
          <Suspense
            fallback={
              <div className="h-56 animate-pulse rounded-2xl bg-[var(--enver-surface)]" />
            }
          >
            <RevenueTrendCard
              points={data.trend}
              trendRange={data.query.trendRange}
              metric={data.query.trendMetric}
            />
          </Suspense>
          <CashflowCard data={data.cashflow} />
          {perms.paymentsView || perms.marginView ? (
            <FinanceOverviewCard
              data={data.finance}
              financeRange={data.query.financeRange}
            />
          ) : null}
          {perms.productionView ? (
            <ProductionOverviewCard data={data.production} />
          ) : null}
          {perms.procurementView ? (
            <ProcurementOverviewCard data={data.procurement} />
          ) : null}
        </div>

        <div className="space-y-6 xl:col-span-5 2xl:col-span-4">
          <NextBestActionsCard items={data.nextActions} />
          <DailyOperatingCard data={data.daily} />
          <BehaviorEngineCard data={data.behavior} />
          {perms.dealsView ? <RiskCenterCard rows={data.risks} /> : null}
          {data.layout !== "sales" ? (
            <TeamPerformanceCard data={data.team} />
          ) : null}
          {data.schedule ? <ScheduleWidget data={data.schedule} /> : null}
          <DirectorAiPanel initial={data.directorAi} aiContextText={aiContext} />
        </div>
      </div>
    </DashboardShell>
  );
}
