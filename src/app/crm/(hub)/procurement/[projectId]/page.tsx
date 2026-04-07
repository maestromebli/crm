import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "../../../../../components/shared/PageHeader";
import { SectionCard } from "../../../../../components/shared/SectionCard";
import { StickySidePanel } from "../../../../../components/shared/StickySidePanel";
import { SummaryCard } from "../../../../../components/shared/SummaryCard";
import { ProcurementItemsTable } from "../../../../../features/procurement/components/ProcurementItemsTable";
import { ProcurementRequestsTable } from "../../../../../features/procurement/components/ProcurementRequestsTable";
import { PurchaseOrdersTable } from "../../../../../features/procurement/components/PurchaseOrdersTable";
import { GoodsReceiptsTable } from "../../../../../features/procurement/components/GoodsReceiptsTable";
import { getProcurementProjectData } from "../../../../../features/procurement/data/repository";
import { canAccess, resolveRole } from "../../../../../features/shared/lib/rbac";
import { EmptyState } from "../../../../../components/shared/EmptyState";
import { AiV2InsightCard } from "../../../../../features/ai-v2";

type Props = { params: Promise<{ projectId: string }>; searchParams?: Promise<{ role?: string }> };

export default async function ProcurementProjectPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const role = resolveRole((await searchParams)?.role);
  const data = await getProcurementProjectData(projectId);
  if (!data) return notFound();

  const { projectNameById, supplierNameById, categoryNameById, orderNumberById } = data;

  const exceeded = data.items.filter((i) => (i.actualTotalCost ?? 0) > i.plannedTotalCost).length;
  const notOrdered = data.items.filter((i) => i.status === "APPROVED").length;
  const notReceived = data.items.filter((i) => i.status !== "RECEIVED").length;

  return (
    <main className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--enver-muted)]">
        <Link href="/crm/procurement" className="hover:text-[var(--enver-text)] hover:underline">
          Закупки
        </Link>
        <span aria-hidden>·</span>
        <span className="text-[var(--enver-text)]">
          {data.dataSource === "live" ? "Угода (CRM)" : "Проєкт (демо)"}
        </span>
      </div>

      {data.dataSource === "demo" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Демо-проєкт з mock-даних. Для реальної угоди відкрийте сторінку з ID угоди з CRM (той самий маршрут з{" "}
          <code className="rounded bg-slate-100 px-1">dealId</code>).
        </p>
      ) : null}

      <PageHeader
        title={`${data.project.title} (${data.project.code})`}
        subtitle={
          data.dataSource === "live"
            ? "Закупівлі по угоді: заявки, позиції, замовлення постачальникам (дані з CRM)."
            : "Закупівлі проєкту: бюджет, замовлення, поставки (демо)."
        }
        actionsSlot={
          <div className="flex flex-wrap items-center gap-2">
            {data.dataSource === "live" ? (
              <Link
                href={`/deals/${projectId}/workspace`}
                className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
              >
                Робоче місце угоди
              </Link>
            ) : null}
            {canAccess(role, "PROCUREMENT_FULL") ? (
              <Link
                href={
                  data.dataSource === "live"
                    ? `/crm/procurement?newRequest=1&dealId=${encodeURIComponent(projectId)}`
                    : "/crm/procurement?newRequest=1"
                }
                className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
              >
                Нова заявка
              </Link>
            ) : null}
            <Link
              href="/crm/procurement?view=hub"
              className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-[var(--enver-muted)] hover:bg-[var(--enver-hover)]"
            >
              Операційний hub
            </Link>
          </div>
        }
      />
      {data.dataSource === "live" ? (
        <AiV2InsightCard context="procurement" dealId={projectId} />
      ) : (
        <AiV2InsightCard context="procurement" />
      )}
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="План закупки" value={data.summary.planned.toLocaleString("uk-UA")} />
        <SummaryCard label="Факт закупки" value={data.summary.actual.toLocaleString("uk-UA")} tone="expense" />
        <SummaryCard
          label="Різниця"
          value={data.summary.delta.toLocaleString("uk-UA")}
          tone={data.summary.delta > 0 ? "warning" : "income"}
        />
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
            <PurchaseOrdersTable
              rows={data.orders}
              supplierNameById={supplierNameById}
              projectNameById={projectNameById}
            />
          </SectionCard>
          <SectionCard title="Поставки">
            <GoodsReceiptsTable
              rows={data.receipts}
              orderNumberById={orderNumberById}
              projectNameById={projectNameById}
            />
          </SectionCard>
        </div>
        <StickySidePanel>
          <SectionCard title="Ризик-панель">
            <div className="space-y-2 text-xs text-slate-700">
              <p>Позиції з перевищенням: {exceeded}</p>
              <p>Не замовлені позиції: {notOrdered}</p>
              <p>Не отримані позиції: {notReceived}</p>
              <p>
                Борг постачальникам:{" "}
                {Math.max(data.summary.ordered - data.summary.received, 0).toLocaleString("uk-UA")} грн
              </p>
              {data.dataSource === "live" && data.summary.overdueLines > 0 ? (
                <p className="font-medium text-amber-800">
                  Прострочені відкриті рядки (за датою заявки): {data.summary.overdueLines}
                </p>
              ) : null}
            </div>
          </SectionCard>
        </StickySidePanel>
      </div>
    </main>
  );
}
