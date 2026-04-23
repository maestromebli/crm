import { PageHeader } from "../../../../components/shared/PageHeader";
import { SectionCard } from "../../../../components/shared/SectionCard";
import { StickySidePanel } from "../../../../components/shared/StickySidePanel";
import Link from "next/link";
import { getProcurementOverviewData } from "../../../../features/procurement/data/repository";
import { ProcurementKpiCards } from "../../../../features/procurement/components/ProcurementKpiCards";
import { ProcurementRequestsTable } from "../../../../features/procurement/components/ProcurementRequestsTable";
import { ProcurementItemsTable } from "../../../../features/procurement/components/ProcurementItemsTable";
import { PurchaseOrdersTable } from "../../../../features/procurement/components/PurchaseOrdersTable";
import { SuppliersTable } from "../../../../features/procurement/components/SuppliersTable";
import { GoodsReceiptsTable } from "../../../../features/procurement/components/GoodsReceiptsTable";
import { ProcurementRiskPanel } from "../../../../features/procurement/components/ProcurementRiskPanel";
import { ProcurementOrderedMonitorTable } from "../../../../features/procurement/components/ProcurementOrderedMonitorTable";
import { ProcurementRequestDrawer } from "../../../../features/procurement/components/ProcurementRequestDrawer";
import { EmptyState } from "../../../../components/shared/EmptyState";
import { canAccess, resolveRole } from "../../../../features/shared/lib/rbac";
import { formatMoneyUa } from "../../../../features/finance/lib/format-money";
import { StatusBadge } from "../../../../components/shared/StatusBadge";
import { ProcurementHubClient } from "./ProcurementHubClient";
import { AiV2InsightCard } from "../../../../features/ai-v2";
import {
  buildProcurementHubHref,
  buildProcurementHubNewRequestHref,
  parseProcurementQuickAction,
} from "../../../../features/procurement/lib/quick-actions";
import { hasUnrestrictedPermissionScope } from "@/lib/authz/permissions";
import { getCachedServerSession } from "@/lib/authz/server-session";
import { redirect } from "next/navigation";

type Props = {
  searchParams?: Promise<{ role?: string; view?: string; newRequest?: string; dealId?: string; tab?: string }>;
};

export default async function ProcurementOverviewPage({ searchParams }: Props) {
  const session = await getCachedServerSession();
  const hasUnrestricted = hasUnrestrictedPermissionScope({
    realRole: session?.user?.realRole,
    impersonatorId: session?.user?.impersonatorId,
  });
  if (
    !hasUnrestricted &&
    session?.user?.realRole !== "ACCOUNTANT" &&
    session?.user?.realRole !== "PROCUREMENT_MANAGER"
  ) {
    redirect("/access-denied");
  }

  const params = await searchParams;
  const role = resolveRole(params?.role);
  const quickAction = parseProcurementQuickAction(params);
  const viewMode = quickAction.isHubView ? "hub" : "overview";

  if (viewMode === "hub") {
    return (
      <main className="space-y-4 p-4">
        <PageHeader
          title="Закупки"
          subtitle="Оперативний ERP-хаб: заявки, PO, постачальники та SLA в єдиному контурі."
          actionsSlot={
            <div className="inline-flex rounded-lg border border-[var(--enver-border)] bg-[var(--enver-bg)] p-1">
              <Link
                href="/crm/procurement"
                className="enver-cta enver-cta-sm enver-cta-ghost"
              >
                Аналітичний огляд
              </Link>
              <span className="enver-cta enver-cta-sm enver-cta-primary">
                Оперативний хаб
              </span>
            </div>
          }
        />
        <AiV2InsightCard context="procurement" />
        <ProcurementHubClient
          initialOpenNewRequest={quickAction.openNewRequest}
          initialDealId={quickAction.dealId}
        />
      </main>
    );
  }

  const data = await getProcurementOverviewData();
  const overviewTab = params?.tab === "analytics" ? "analytics" : params?.tab === "tables" ? "tables" : "monitor";
  const roleQuery = params?.role ? `&role=${encodeURIComponent(params.role)}` : "";
  const projectNameById = data.projectNameById;
  const supplierNameById = data.supplierNameById;
  const categoryNameById = Object.fromEntries(data.categories.map((c) => [c.id, c.name]));
  const orderNumberById = data.orderNumberById;

  return (
    <main className="space-y-4 p-4">
      <PageHeader
        title="Закупки"
        subtitle="Управління заявками, постачальниками, замовленнями і бюджетом (дані з CRM)."
        actionsSlot={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[var(--enver-border)] bg-[var(--enver-bg)] p-1">
              <span className="enver-cta enver-cta-sm enver-cta-primary">
                Аналітичний огляд
              </span>
              <Link
                href={buildProcurementHubHref()}
                className="enver-cta enver-cta-sm enver-cta-ghost"
              >
                Оперативний хаб
              </Link>
            </div>
            {canAccess(role, "PROCUREMENT_FULL") ? (
              <>
                <Link
                  href={buildProcurementHubNewRequestHref()}
                  className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
                >
                  Нова заявка
                </Link>
                <Link
                  href={`${buildProcurementHubHref()}#supplier-onboarding`}
                  className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
                >
                  Постачальник у hub
                </Link>
              </>
            ) : null}
          </div>
        }
      />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span className="font-medium text-slate-700">Швидкі звʼязки:</span>
        <Link href="/crm/production" className="text-sky-700 underline-offset-2 hover:underline">
          штаб виробництва
        </Link>
        <Link href="/crm/production/workshop" className="text-sky-700 underline-offset-2 hover:underline">
          Kanban цеху
        </Link>
      </p>
      <AiV2InsightCard context="procurement" />
      {canAccess(role, "PROCUREMENT_FULL") ? (
        <ProcurementRequestDrawer
          defaultOpen={params?.newRequest === "1"}
          initialDealId={params?.dealId}
        />
      ) : null}
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/crm/procurement?tab=monitor${roleQuery}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              overviewTab === "monitor"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Моніторинг
          </Link>
          <Link
            href={`/crm/procurement?tab=tables${roleQuery}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              overviewTab === "tables"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Операційні таблиці
          </Link>
          <Link
            href={`/crm/procurement?tab=analytics${roleQuery}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              overviewTab === "analytics"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Ризики та аналітика
          </Link>
        </div>
      </div>
      {overviewTab === "monitor" ? (
        <>
      <ProcurementKpiCards kpi={data.kpi} />
      <SectionCard
        title="Моніторинг замовлених позицій"
        subtitle="KPI, пошук, сортування, експорт CSV; строки дедлайну, залишок бюджету та % виконання по кожному рядку"
      >
        <ProcurementOrderedMonitorTable
          rows={data.orderedLineMonitor}
          maxRows={60}
          compact
          tableScrollClassName="max-h-[min(560px,70vh)] overflow-y-auto"
        />
      </SectionCard>
      <SectionCard
        title="Контур контролю закупівель"
        subtitle="SLA постачальників, концентрація, якість приймання і прострочені потреби"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">OTD постачань</p>
            <p className="mt-1 text-lg font-semibold text-[var(--enver-text)]">
              {data.saasControl.onTimeDeliveryRatePct}%
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Якість приймання: {data.saasControl.receiptQualityRate}%
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Покриття комітменту</p>
            <p className="mt-1 text-lg font-semibold text-[var(--enver-text)]">
              {data.saasControl.commitmentCoveragePct}%
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Розрив: {formatMoneyUa(data.kpi.openCommitmentGap)} грн
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Відкриті заявки</p>
            <p className="mt-1 text-lg font-semibold text-[var(--enver-text)]">
              {data.saasControl.openRequestCount}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Прострочені: {data.saasControl.overdueOpenRequestCount}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Системний ризик</p>
            <p className="mt-1 text-lg font-semibold text-[var(--enver-text)]">
              {data.saasControl.systemicRiskScore}/100
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Загальний ризик закупівельного контуру
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Концентрація топ-постачальника</p>
            <p className="mt-1 text-lg font-semibold text-[var(--enver-text)]">
              {data.saasControl.topSupplierConcentrationPct}%
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Контролюйте залежність від одного постачальника та ціновий ризик
            </p>
          </div>
        </div>
      </SectionCard>
        </>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {overviewTab === "tables" ? (
            <>
          <SectionCard title="Заявки" subtitle="Поточний стан і бюджет">
            {canAccess(role, "PROCUREMENT_FULL") || canAccess(role, "PROCUREMENT_SUMMARY") ? (
              <ProcurementRequestsTable rows={data.requests} projectNameById={projectNameById} />
            ) : (
              <EmptyState title="Немає доступу до закупок" description="Недостатньо прав для перегляду таблиць закупок." />
            )}
          </SectionCard>
          <SectionCard title="Позиції" subtitle="План / факт по закупках">
            <ProcurementItemsTable
              rows={data.items}
              projectNameById={projectNameById}
              categoryNameById={categoryNameById}
              supplierNameById={supplierNameById}
            />
          </SectionCard>
          <SectionCard title="Замовлення постачальникам">
            <PurchaseOrdersTable
              rows={data.purchaseOrders}
              supplierNameById={supplierNameById}
              projectNameById={projectNameById}
            />
          </SectionCard>
          <SectionCard title="Постачальники">
            <SuppliersTable rows={data.suppliers} />
          </SectionCard>
          <SectionCard title="Поставки">
            <GoodsReceiptsTable
              rows={data.receipts}
              orderNumberById={orderNumberById}
              projectNameById={projectNameById}
            />
          </SectionCard>
            </>
          ) : null}
          {overviewTab === "analytics" ? (
            <>
          <SectionCard title="Профіль постачальників" subtitle="Фокус витрат і незакриті замовлення по постачальниках">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Постачальник</th>
                    <th className="px-2 py-2">Обсяг</th>
                    <th className="px-2 py-2">Частка</th>
                    <th className="px-2 py-2">Відкриті PO</th>
                  </tr>
                </thead>
                <tbody>
                  {data.saasControl.supplierScorecard.map((row) => (
                    <tr key={row.supplierId} className="border-t border-slate-100">
                      <td className="px-2 py-2 font-medium text-[var(--enver-text)]">{row.supplierName}</td>
                      <td className="px-2 py-2">{formatMoneyUa(row.spend)} грн</td>
                      <td className="px-2 py-2">{row.sharePct}%</td>
                      <td className="px-2 py-2">
                        {row.openPoCount > 2 ? (
                          <StatusBadge label={`${row.openPoCount} (ризик)`} tone="warning" />
                        ) : (
                          <StatusBadge label={String(row.openPoCount)} tone="success" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
          <SectionCard title="Прострочені заявки" subtitle="Що блокує виробництво найближчим часом">
            {data.saasControl.overdueRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-2">Заявка</th>
                      <th className="px-2 py-2">Проєкт</th>
                      <th className="px-2 py-2">Потрібно до</th>
                      <th className="px-2 py-2">Бюджет</th>
                      <th className="px-2 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.saasControl.overdueRequests.map((row) => (
                      <tr key={row.requestId} className="border-t border-slate-100">
                        <td className="px-2 py-2 font-medium text-[var(--enver-text)]">
                          <Link
                            href={`/crm/procurement/${row.projectId}`}
                            className="text-sky-800 underline-offset-2 hover:text-sky-950 hover:underline"
                          >
                            {row.requestId}
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-slate-600">
                          <Link
                            href={`/crm/procurement/${row.projectId}`}
                            className="text-sky-800 underline-offset-2 hover:text-sky-950 hover:underline"
                          >
                            {projectNameById[row.projectId] ?? row.projectId}
                          </Link>
                        </td>
                        <td className="px-2 py-2">{row.neededByDate ?? "—"}</td>
                        <td className="px-2 py-2">{formatMoneyUa(row.budgetTotal)} грн</td>
                        <td className="px-2 py-2">
                          <StatusBadge label={row.status} tone="danger" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="Немає критичних прострочень"
                description="Openх заявок із дедлайном у минулому не знайдено."
              />
            )}
          </SectionCard>
          <SectionCard title="Радар ризиків постачальників" subtitle="SLA, платіжна дисципліна, затримки й інтегральний ризик">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Постачальник</th>
                    <th className="px-2 py-2">SLA</th>
                    <th className="px-2 py-2">Платіжна дисципліна</th>
                    <th className="px-2 py-2">Прострочені PO</th>
                    <th className="px-2 py-2">Ризик</th>
                  </tr>
                </thead>
                <tbody>
                  {data.saasControl.supplierRisks.map((row) => (
                    <tr key={row.supplierId} className="border-t border-slate-100">
                      <td className="px-2 py-2 font-medium text-[var(--enver-text)]">{row.supplierName}</td>
                      <td className="px-2 py-2">{row.slaPct}%</td>
                      <td className="px-2 py-2">{row.paymentDisciplinePct}%</td>
                      <td className="px-2 py-2">{row.lateOrders}</td>
                      <td className="px-2 py-2">
                        <StatusBadge
                          label={`${row.riskScore}/100 · ${row.riskLabel}`}
                          tone={row.riskScore >= 70 ? "danger" : row.riskScore >= 45 ? "warning" : "success"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
            </>
          ) : null}
        </div>
        {overviewTab !== "monitor" ? (
          <StickySidePanel>
            <ProcurementRiskPanel risks={data.riskAlerts} />
          </StickySidePanel>
        ) : null}
      </div>
    </main>
  );
}
