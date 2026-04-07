import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "../../../../../components/shared/PageHeader";
import { SectionCard } from "../../../../../components/shared/SectionCard";
import { StickySidePanel } from "../../../../../components/shared/StickySidePanel";
import { SummaryCard } from "../../../../../components/shared/SummaryCard";
import { FinanceTransactionsTable } from "../../../../../features/finance/components/FinanceTransactionsTable";
import { PaymentPlanTable } from "../../../../../features/finance/components/PaymentPlanTable";
import { getFinanceProjectData } from "../../../../../features/finance/data/repository";
import { mockClients, mockFinanceCategories, mockProjects } from "../../../../../features/shared/data/mock-crm";
import { EmptyState } from "../../../../../components/shared/EmptyState";
import { canAccess, resolveRole } from "../../../../../features/shared/lib/rbac";

type Props = { params: Promise<{ projectId: string }>; searchParams?: Promise<{ role?: string }> };

export default async function FinanceProjectPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const role = resolveRole((await searchParams)?.role);
  const data = await getFinanceProjectData(projectId);
  if (!data) return notFound();
  const client = mockClients.find((c) => c.id === data.project.clientId);
  const projectNameById = Object.fromEntries(mockProjects.map((p) => [p.id, `${p.code} · ${p.title}`]));
  const categoryNameById = Object.fromEntries(mockFinanceCategories.map((c) => [c.id, c.name]));

  return (
    <main className="space-y-4 p-4">
      <PageHeader
        title={`${data.project.title} (${data.project.code})`}
        subtitle={`Клієнт: ${client?.name ?? "—"} · Менеджер: ${data.project.managerId}`}
        actions={[{ label: "Додати транзакцію" }, { label: "Експорт по проєкту" }]}
      />
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Сума договору" value={data.summary.contractAmount.toLocaleString("uk-UA")} />
        <SummaryCard label="Отримано" value={data.summary.receivedFromClient.toLocaleString("uk-UA")} tone="income" />
        <SummaryCard label="Борг клієнта" value={data.summary.clientDebt.toLocaleString("uk-UA")} tone="warning" />
        <SummaryCard label="План витрат" value={data.summary.plannedExpenses.toLocaleString("uk-UA")} />
        <SummaryCard label="Факт витрат" value={data.summary.actualExpenses.toLocaleString("uk-UA")} tone="expense" />
        <SummaryCard label="Чистий прибуток" value={data.summary.netProfit.toLocaleString("uk-UA")} tone={data.summary.netProfit >= 0 ? "income" : "expense"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <SectionCard title="Об'єкти угоди та зв'язки" subtitle="Адреси монтажу, закупівля та фінанси по проєкту">
            <div className="space-y-2">
              {data.objects.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">{o.title}</p>
                    <p className="text-xs text-slate-600">{o.objectType} · {o.address}</p>
                  </div>
                  <Link
                    href={`/crm/procurement/${projectId}`}
                    className="text-xs font-medium text-amber-900 underline-offset-2 hover:underline"
                  >
                    Закупівлі об'єкта
                  </Link>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="План оплат" subtitle="План / оплата / статус">
            {canAccess(role, "FINANCE_SUMMARY") ? (
              <PaymentPlanTable rows={data.paymentPlan} />
            ) : (
              <EmptyState title="Немає доступу" description="Недостатньо прав для перегляду плану оплат." />
            )}
          </SectionCard>
          <SectionCard title="Фактичні транзакції" subtitle="Історія надходжень і витрат">
            <FinanceTransactionsTable
              rows={data.transactions}
              projectNameById={projectNameById}
              categoryNameById={categoryNameById}
            />
          </SectionCard>
        </div>
        <StickySidePanel>
          <SectionCard title="Контроль" subtitle="Баланс і попередження">
            <div className="space-y-2 text-xs text-slate-700">
              <p>Маржа: {((data.summary.netProfit / Math.max(data.summary.contractAmount, 1)) * 100).toFixed(2)}%</p>
              <p>Борг постачальникам: {data.summary.supplierDebt.toLocaleString("uk-UA")} UAH</p>
              {data.summary.clientDebt === 0 && data.summary.supplierDebt > 0 ? (
                <p className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-800">
                  Клієнт оплатив повністю, але залишились незакриті оплати постачальникам
                </p>
              ) : null}
            </div>
          </SectionCard>
        </StickySidePanel>
      </div>
    </main>
  );
}

