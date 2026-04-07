import { notFound } from "next/navigation";
import { PageHeader } from "../../../../../components/shared/PageHeader";
import { SectionCard } from "../../../../../components/shared/SectionCard";
import { StickySidePanel } from "../../../../../components/shared/StickySidePanel";
import { SummaryCard } from "../../../../../components/shared/SummaryCard";
import { ProcurementItemsTable } from "../../../../../features/procurement/components/ProcurementItemsTable";
import { ProcurementRequestsTable } from "../../../../../features/procurement/components/ProcurementRequestsTable";
import { PurchaseOrdersTable } from "../../../../../features/procurement/components/PurchaseOrdersTable";
import { GoodsReceiptsTable } from "../../../../../features/procurement/components/GoodsReceiptsTable";
import { getProcurementProjectData } from "../../../../../features/procurement/data/repository";
import {
  mockProcurementCategories,
  mockProjects,
  mockPurchaseOrders,
  mockSuppliers,
} from "../../../../../features/shared/data/mock-crm";
import { canAccess, resolveRole } from "../../../../../features/shared/lib/rbac";
import { EmptyState } from "../../../../../components/shared/EmptyState";

type Props = { params: Promise<{ projectId: string }>; searchParams?: Promise<{ role?: string }> };

export default async function ProcurementProjectPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const role = resolveRole((await searchParams)?.role);
  const data = await getProcurementProjectData(projectId);
  if (!data) return notFound();

  const projectNameById = Object.fromEntries(mockProjects.map((p) => [p.id, `${p.code} · ${p.title}`]));
  const supplierNameById = Object.fromEntries(mockSuppliers.map((s) => [s.id, s.name]));
  const categoryNameById = Object.fromEntries(mockProcurementCategories.map((c) => [c.id, c.name]));
  const orderNumberById = Object.fromEntries(mockPurchaseOrders.map((p) => [p.id, p.orderNumber]));

  const exceeded = data.items.filter((i) => (i.actualTotalCost ?? 0) > i.plannedTotalCost).length;
  const notOrdered = data.items.filter((i) => i.status === "APPROVED").length;
  const notReceived = data.items.filter((i) => i.status !== "RECEIVED").length;

  return (
    <main className="space-y-4 p-4">
      <PageHeader
        title={`${data.project.title} (${data.project.code})`}
        subtitle="Закупки проєкту: бюджет, замовлення, поставки."
        actions={[{ label: "Створити заявку" }, { label: "Створити замовлення" }]}
      />
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="План закупки" value={data.summary.planned.toLocaleString("uk-UA")} />
        <SummaryCard label="Факт закупки" value={data.summary.actual.toLocaleString("uk-UA")} tone="expense" />
        <SummaryCard label="Різниця" value={data.summary.delta.toLocaleString("uk-UA")} tone={data.summary.delta > 0 ? "warning" : "income"} />
        <SummaryCard label="Замовлено" value={data.summary.ordered.toLocaleString("uk-UA")} />
        <SummaryCard label="Отримано" value={data.summary.received.toLocaleString("uk-UA")} />
        <SummaryCard label="Не закрито" value={String(data.summary.notClosed)} tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <SectionCard title="Заявки">
            {canAccess(role, "PROCUREMENT_SUMMARY") ? (
              <ProcurementRequestsTable rows={data.requests} projectNameById={projectNameById} />
            ) : (
              <EmptyState title="Немає доступу" description="Недостатньо прав для перегляду заявок." />
            )}
          </SectionCard>
          <SectionCard title="Позиції">
            <ProcurementItemsTable
              rows={data.items}
              projectNameById={projectNameById}
              categoryNameById={categoryNameById}
              supplierNameById={supplierNameById}
            />
          </SectionCard>
          <SectionCard title="Замовлення">
            <PurchaseOrdersTable rows={data.orders} supplierNameById={supplierNameById} projectNameById={projectNameById} />
          </SectionCard>
          <SectionCard title="Поставки">
            <GoodsReceiptsTable rows={data.receipts} orderNumberById={orderNumberById} projectNameById={projectNameById} />
          </SectionCard>
        </div>
        <StickySidePanel>
          <SectionCard title="Ризик-панель">
            <div className="space-y-2 text-xs text-slate-700">
              <p>Позиції з перевищенням: {exceeded}</p>
              <p>Не замовлені позиції: {notOrdered}</p>
              <p>Не отримані позиції: {notReceived}</p>
              <p>Борг постачальникам: {Math.max(data.summary.ordered - data.summary.received, 0).toLocaleString("uk-UA")} UAH</p>
            </div>
          </SectionCard>
        </StickySidePanel>
      </div>
    </main>
  );
}

