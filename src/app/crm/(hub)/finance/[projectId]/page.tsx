import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "../../../../../components/shared/PageHeader";
import { SectionCard } from "../../../../../components/shared/SectionCard";
import { StickySidePanel } from "../../../../../components/shared/StickySidePanel";
import { SummaryCard } from "../../../../../components/shared/SummaryCard";
import { FinanceTransactionsTable } from "../../../../../features/finance/components/FinanceTransactionsTable";
import { PaymentPlanTable } from "../../../../../features/finance/components/PaymentPlanTable";
import { getFinanceProjectData } from "../../../../../features/finance/data/repository";
import { FINANCE_CATEGORY_CATALOG } from "../../../../../lib/finance/finance-dictionaries";
import { EmptyState } from "../../../../../components/shared/EmptyState";
import { canAccess, resolveRole } from "../../../../../features/shared/lib/rbac";
import { formatMoneyUa } from "../../../../../features/finance/lib/format-money";

type Props = { params: Promise<{ projectId: string }>; searchParams?: Promise<{ role?: string }> };

export default async function FinanceProjectPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const role = resolveRole((await searchParams)?.role);
  const data = await getFinanceProjectData(projectId);
  if (!data) return notFound();
  const clientName = data.clientName ?? "—";
  const projectNameById = { [data.project.id]: `${data.project.code} · ${data.project.title}` };
  const categoryNameById = Object.fromEntries(FINANCE_CATEGORY_CATALOG.map((c) => [c.id, c.name]));
  const incomeByTx = data.transactions
    .filter((tx) => tx.type === "INCOME" && tx.status !== "CANCELLED")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const expenseByTx = data.transactions
    .filter((tx) => tx.type === "EXPENSE" && tx.status !== "CANCELLED")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const payrollByTx = data.transactions
    .filter((tx) => tx.type === "PAYROLL" && tx.status !== "CANCELLED")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const commissionByTx = data.transactions
    .filter((tx) => tx.type === "COMMISSION" && tx.status !== "CANCELLED")
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <main className="space-y-4 p-4">
      <PageHeader
        title={`Фінансовий кабінет замовлення: ${data.project.code}`}
        subtitle={`${data.project.title} · Клієнт: ${clientName} · Менеджер: ${data.project.managerId}`}
        actions={[{ label: "Додати транзакцію" }, { label: "Експорт по проєкту" }]}
      />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <Link href="/crm/finance" className="text-sky-700 underline-offset-2 hover:underline">
          До матриці замовлень
        </Link>
        <Link
          href={`/crm/procurement/${projectId}`}
          className="text-emerald-700 underline-offset-2 hover:underline"
        >
          Закупівлі цього замовлення
        </Link>
      </p>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Сума договору" value={data.summary.contractAmount.toLocaleString("uk-UA")} />
        <SummaryCard label="Отримано" value={data.summary.receivedFromClient.toLocaleString("uk-UA")} tone="income" />
        <SummaryCard label="Борг клієнта" value={data.summary.clientDebt.toLocaleString("uk-UA")} tone="warning" />
        <SummaryCard label="План витрат" value={data.summary.plannedExpenses.toLocaleString("uk-UA")} />
        <SummaryCard label="Факт витрат" value={data.summary.actualExpenses.toLocaleString("uk-UA")} tone="expense" />
        <SummaryCard label="Чистий прибуток" value={data.summary.netProfit.toLocaleString("uk-UA")} tone={data.summary.netProfit >= 0 ? "income" : "expense"} />
      </div>
      <SectionCard title="Зріз по фінансових контурах" subtitle="Повна картина руху коштів по цьому замовленню">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Надходження (cash)" value={`${formatMoneyUa(incomeByTx)} грн`} tone="income" />
          <SummaryCard label="Витрати (cash)" value={`${formatMoneyUa(expenseByTx)} грн`} tone="expense" />
          <SummaryCard label="Зарплата" value={`${formatMoneyUa(payrollByTx)} грн`} />
          <SummaryCard label="Комісії" value={`${formatMoneyUa(commissionByTx)} грн`} />
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <SectionCard title="Об'єкти замовлення та зв'язки" subtitle="Адреси монтажу, закупівля та фінанси по проєкту">
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
                  <span className="text-xs text-slate-500">Закупівлі: через бокове меню</span>
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

