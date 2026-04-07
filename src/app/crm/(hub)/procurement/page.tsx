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

type Props = {
  searchParams?: Promise<{ role?: string; view?: string; newRequest?: string; dealId?: string }>;
};

export default async function ProcurementOverviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const role = resolveRole(params?.role);
  const viewMode = params?.view === "hub" ? "hub" : "overview";

  if (viewMode === "hub") {
    return (
      <main className="space-y-4 p-4">
        <PageHeader
          title="Закупки"
          subtitle="Live ERP hub: заявки, PO, постачальники та SLA в оперативному контурі."
          actionsSlot={
            <div className="inline-flex rounded-lg border border-[var(--enver-border)] bg-[var(--enver-bg)] p-1">
              <Link
                href="/crm/procurement"
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--enver-muted)] hover:bg-[var(--enver-hover)]"
              >
                Аналітичний огляд
              </Link>
              <span className="rounded-md bg-[var(--enver-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--enver-accent-hover)]">
                Live hub
              </span>
            </div>
          }
        />
        <AiV2InsightCard context="procurement" />
        <ProcurementHubClient />
      </main>
    );
  }

  const data = await getProcurementOverviewData();
  const projectNameById = data.projectNameById;
  const supplierNameById = data.supplierNameById;
  const categoryNameById = Object.fromEntries(data.categories.map((c) => [c.id, c.name]));
  const orderNumberById = data.orderNumberById;

  return (
    <main className="space-y-4 p-4">
      <PageHeader
        title="Закупки"
        subtitle={
          data.dataSource === "live"
            ? "Управління заявками, постачальниками, замовленнями і бюджетом (дані з CRM)."
            : "Управління заявками, постачальниками, замовленнями і бюджетом (демо-набір)."
        }
        actionsSlot={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[var(--enver-border)] bg-[var(--enver-bg)] p-1">
              <span className="rounded-md bg-[var(--enver-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--enver-accent-hover)]">
                Аналітичний огляд
              </span>
              <Link
                href="/crm/procurement?view=hub"
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--enver-muted)] hover:bg-[var(--enver-hover)]"
              >
                Live hub
              </Link>
            </div>
            {canAccess(role, "PROCUREMENT_FULL") ? (
              <>
                <Link
                  href="/crm/procurement?newRequest=1"
                  className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
                >
                  Нова заявка
                </Link>
                <Link
                  href="/crm/procurement?view=hub#supplier-onboarding"
                  className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
                >
                  Постачальник у hub
                </Link>
              </>
            ) : null}
          </div>
        }
      />
      {data.dataSource === "demo" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Показано демо-дані. Підключіть БД і заповніть угоди / закупівлі — тут з’являться реальні цифри.
        </p>
      ) : null}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span className="font-medium text-slate-700">Швидкі звʼязки:</span>
        <Link href="/crm/production" className="text-sky-700 underline-offset-2 hover:underline">
          штаб виробництва
        </Link>
        <Link href="/crm/production/workshop" className="text-sky-700 underline-offset-2 hover:underline">
          Kanban цеху
        </Link>
        <Link href="/crm/finance" className="text-sky-700 underline-offset-2 hover:underline">
          фінанси
        </Link>
      </p>
      <AiV2InsightCard context="procurement" />
      {canAccess(role, "PROCUREMENT_FULL") ? (
        <ProcurementRequestDrawer
          defaultOpen={params?.newRequest === "1"}
          initialDealId={params?.dealId}
        />
      ) : null}
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
        title="SaaS procurement control"
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
            <p className="text-xs text-slate-500">Systemic risk</p>
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
              Контролюйте vendor lock-in та ціновий ризик
            </p>
          </div>
        </div>
      </SectionCard>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
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
          <SectionCard title="Supplier scorecard" subtitle="Фокус витрат і незакриті замовлення по постачальниках">
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
                description="Відкритих заявок із дедлайном у минулому не знайдено."
              />
            )}
          </SectionCard>
          <SectionCard title="Supplier risk radar" subtitle="SLA, платіжна дисципліна, затримки і composite risk">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Постачальник</th>
                    <th className="px-2 py-2">SLA</th>
                    <th className="px-2 py-2">Payment discipline</th>
                    <th className="px-2 py-2">Late PO</th>
                    <th className="px-2 py-2">Risk</th>
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
        </div>
        <StickySidePanel>
          <ProcurementRiskPanel risks={data.riskAlerts} />
        </StickySidePanel>
      </div>
    </main>
  );
}
