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
import { ProcurementRequestDrawer } from "../../../../features/procurement/components/ProcurementRequestDrawer";
import { EmptyState } from "../../../../components/shared/EmptyState";
import { canAccess, resolveRole } from "../../../../features/shared/lib/rbac";
import {
  mockProcurementCategories,
  mockProjects,
  mockPurchaseOrders,
  mockSuppliers,
} from "../../../../features/shared/data/mock-crm";
import { formatMoneyUa } from "../../../../features/finance/lib/format-money";
import { StatusBadge } from "../../../../components/shared/StatusBadge";
import { ProcurementHubClient } from "./ProcurementHubClient";

type Props = { searchParams?: Promise<{ role?: string; view?: string }> };

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
        <ProcurementHubClient />
      </main>
    );
  }

  const data = await getProcurementOverviewData();
  const projectNameById = Object.fromEntries(mockProjects.map((p) => [p.id, `${p.code} · ${p.title}`]));
  const supplierNameById = Object.fromEntries(mockSuppliers.map((s) => [s.id, s.name]));
  const categoryNameById = Object.fromEntries(mockProcurementCategories.map((c) => [c.id, c.name]));
  const orderNumberById = Object.fromEntries(mockPurchaseOrders.map((p) => [p.id, p.orderNumber]));

  return (
    <main className="space-y-4 p-4">
      <PageHeader
        title="Закупки"
        subtitle="Управління заявками, постачальниками, замовленнями і бюджетом."
        actionsSlot={
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
        }
      />
      {canAccess(role, "PROCUREMENT_FULL") ? <ProcurementRequestDrawer /> : null}
      <ProcurementKpiCards kpi={data.kpi} />
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
                      <th className="px-2 py-2">Request</th>
                      <th className="px-2 py-2">Проєкт</th>
                      <th className="px-2 py-2">Потрібно до</th>
                      <th className="px-2 py-2">Бюджет</th>
                      <th className="px-2 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.saasControl.overdueRequests.map((row) => (
                      <tr key={row.requestId} className="border-t border-slate-100">
                        <td className="px-2 py-2 font-medium text-[var(--enver-text)]">{row.requestId}</td>
                        <td className="px-2 py-2 text-slate-600">{projectNameById[row.projectId] ?? row.projectId}</td>
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
          <ProcurementRiskPanel
            risks={[
              { level: "P0", text: "Перевищення бюджету по матеріалах у EN-2026-003." },
              { level: "P1", text: "4 позиції не замовлені при близькому дедлайні." },
              { level: "P1", text: "Є частково доставлені замовлення без закриття." },
            ]}
          />
        </StickySidePanel>
      </div>
    </main>
  );
}
