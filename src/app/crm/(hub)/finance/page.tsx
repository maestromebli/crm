import { PageHeader } from "../../../../components/shared/PageHeader";
import { SectionCard } from "../../../../components/shared/SectionCard";
import { StickySidePanel } from "../../../../components/shared/StickySidePanel";
import Link from "next/link";
import { getFinanceOverviewData } from "../../../../features/finance/data/repository";
import { FinanceKpiCards } from "../../../../features/finance/components/FinanceKpiCards";
import { FinanceSummaryPanel } from "../../../../features/finance/components/FinanceSummaryPanel";
import { AddTransactionDrawer } from "../../../../features/finance/components/AddTransactionDrawer";
import { EmptyState } from "../../../../components/shared/EmptyState";
import { canAccess, resolveRole } from "../../../../features/shared/lib/rbac";
import { FinanceHeaderActions } from "../../../../features/finance/components/FinanceHeaderActions";
import { formatMoneyUa } from "../../../../features/finance/lib/format-money";
import { StatusBadge } from "../../../../components/shared/StatusBadge";
import { FinanceHubClient } from "./FinanceHubClient";
import { FinanceObjectFinanceMatrix } from "../../../../features/finance/components/FinanceObjectFinanceMatrix";
import { FinanceOperationsScopePanel } from "../../../../features/finance/components/FinanceOperationsScopePanel";
import { FinancePayrollEntryDrawer } from "../../../../features/finance/components/FinancePayrollEntryDrawer";
import { FinanceDirectorIntakePanel } from "../../../../features/finance/components/FinanceDirectorIntakePanel";
import { AiV2InsightCard } from "../../../../features/ai-v2";

type Props = { searchParams?: Promise<{ role?: string; view?: string; tab?: string }> };

export default async function FinanceOverviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const role = resolveRole(params?.role);
  const viewMode = params?.view === "hub" ? "hub" : "overview";

  if (viewMode === "hub") {
    return (
      <main className="mx-auto max-w-[min(100%,1680px)] space-y-6 px-4 py-5 sm:px-6">
        <PageHeader
          title="Фінанси"
          subtitle="Оперативний ERP-хаб: реєстри, документи та контроль грошових потоків у реальному часі."
          actionsSlot={
            <div className="inline-flex rounded-lg border border-[var(--enver-border)] bg-[var(--enver-bg)] p-1">
              <Link
                href="/crm/finance"
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
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          <span className="font-medium text-slate-700">Операційні контури:</span>
          <Link href="/crm/finance" className="text-sky-700 underline-offset-2 hover:underline">
            аналітика фінансів
          </Link>
          <Link href="/crm/finance/journal" className="text-emerald-800 underline-offset-2 hover:underline">
            журнал проводок
          </Link>
          <Link href="/crm/production" className="text-sky-700 underline-offset-2 hover:underline">
            штаб виробництва
          </Link>
          <Link href="/crm/production/workshop" className="text-sky-700 underline-offset-2 hover:underline">
            Канбан цеху
          </Link>
          <Link href="/crm/procurement" className="text-sky-700 underline-offset-2 hover:underline">
            закупівлі
          </Link>
        </p>
        <AiV2InsightCard context="finance" />
        <FinanceHubClient />
      </main>
    );
  }

  const data = await getFinanceOverviewData();
  const overviewTab = params?.tab === "saas" ? "saas" : "core";
  const roleQuery = params?.role ? `&role=${encodeURIComponent(params.role)}` : "";
  const projectNameById = data.saasAccounting.projectNameById;
  const categoryNameById = Object.fromEntries(data.categories.map((c) => [c.id, c.name]));
  const objectNameById = Object.fromEntries(
    Object.entries(projectNameById).map(([pid, label]) => [`${pid}-obj`, `${label} · об'єкт`]),
  );
  const accountLabelById = Object.fromEntries(data.accounts.map((a) => [a.id, a.name]));
  const projectOptions = Object.entries(projectNameById).map(([id, label]) => ({ id, label }));
  const objectOptions = projectOptions.map((p) => ({
    id: `${p.id}-obj`,
    projectId: p.id,
    label: p.label,
  }));

  return (
    <main className="mx-auto max-w-[min(100%,1680px)] space-y-6 px-4 py-5 sm:px-6 sm:py-6">
      <PageHeader
        title="Фінанси"
        subtitle="Контроль грошей, боргів, витрат і прибутковості: замовлення (проєкт) → об'єкт → закупівля; зведення портфеля та зріз по кожній адресі."
        actionsSlot={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[var(--enver-border)] bg-[var(--enver-bg)] p-1">
              <span className="enver-cta enver-cta-sm enver-cta-primary">
                Аналітичний огляд
              </span>
              <Link
                href="/crm/finance?view=hub"
                className="enver-cta enver-cta-sm enver-cta-ghost"
              >
                Оперативний хаб
              </Link>
            </div>
            {canAccess(role, "FINANCE_FULL") || canAccess(role, "FINANCE_SUMMARY") ? (
              <FinanceHeaderActions
                projects={projectOptions}
                expenseCategories={data.categories
                  .filter((c) => c.group === "EXPENSE")
                  .map((c) => ({ id: c.id, label: c.name }))}
                accounts={data.accounts.map((a) => ({ id: a.id, label: a.name }))}
                canEdit={canAccess(role, "FINANCE_FULL")}
              />
            ) : null}
          </div>
        }
      />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span className="font-medium text-slate-700">Операційні контури:</span>
        <Link href="/crm/production" className="text-sky-700 underline-offset-2 hover:underline">
          штаб виробництва
        </Link>
        <Link href="/crm/production/workshop" className="text-sky-700 underline-offset-2 hover:underline">
          Канбан цеху
        </Link>
        <Link href="/crm/procurement" className="text-sky-700 underline-offset-2 hover:underline">
          закупівлі
        </Link>
        <Link href="/crm/finance/journal" className="text-emerald-800 underline-offset-2 hover:underline">
          журнал проводок
        </Link>
      </p>
      <AiV2InsightCard context="finance" />
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/crm/finance?tab=core${roleQuery}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              overviewTab === "core"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Операційний контур
          </Link>
          <Link
            href={`/crm/finance?tab=saas${roleQuery}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              overviewTab === "saas"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            SaaS-контроль і прогноз
          </Link>
        </div>
      </div>
      {overviewTab === "core" ? (
        <>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/90 via-white to-slate-50/50 p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-800">Швидкі дії:</span> нова проводка або нарахування зарплати
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canAccess(role, "FINANCE_FULL") ? <AddTransactionDrawer /> : null}
          {canAccess(role, "FINANCE_FULL") ? (
            <FinancePayrollEntryDrawer projects={projectOptions} objects={objectOptions} />
          ) : null}
        </div>
      </div>

      <SectionCard
        title="Бухгалтерія та контур замовлень"
        subtitle="Посилання на замовлення та закупівлі; нижче — форми для керівників напрямів (бюджет, виплати, зміни до договору)."
      >
        <div className="mb-5 flex flex-wrap gap-2">
          <Link
            href="/deals"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/70"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" aria-hidden />
            Замовлення CRM
          </Link>
          <Link
            href="/crm/procurement"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 shadow-sm transition hover:bg-amber-100"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
            Закупівлі та PO
          </Link>
        </div>
        <FinanceDirectorIntakePanel projects={projectOptions} />
      </SectionCard>

      <SectionCard
        title="Матриця об'єктів і замовлень"
        subtitle="Показники по кожній адресі окремо; внизу рядок — усі об'єкти разом. Закупівлі з позицій, cash — з проводок."
      >
        <FinanceObjectFinanceMatrix
          rows={data.objectLedger}
          consolidated={data.objectLedgerConsolidated}
        />
      </SectionCard>

      <SectionCard
        title="Реєстр проводок з фільтром"
        subtitle="Перемикайте зріз: усі об'єкти, портфель або одна адреса; колонка «Об'єкт» для зв'язку з монтажем"
      >
        {canAccess(role, "FINANCE_FULL") || canAccess(role, "FINANCE_SUMMARY") ? (
          <FinanceOperationsScopePanel
            transactions={data.transactions}
            objectLedger={data.objectLedger}
            consolidated={data.objectLedgerConsolidated}
            projectNameById={projectNameById}
            categoryNameById={categoryNameById}
            objectNameById={objectNameById}
            accountLabelById={accountLabelById}
          />
        ) : (
          <EmptyState
            title="Немає доступу"
            description="Потрібні права FINANCE_SUMMARY або FINANCE_FULL."
          />
        )}
      </SectionCard>

      <FinanceKpiCards kpi={data.kpi} />
        </>
      ) : null}
      {overviewTab === "saas" ? (
        <>
      <SectionCard
        title="SaaS бухгалтерський контроль"
        subtitle="Старіння боргів, фінансовий запас, покриття зобовʼязань і концентрація постачальників"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Фінансовий запас</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-[var(--enver-text)]">
              {data.saasAccounting.cashRunwayDays} днів
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Останнє надходження: {data.saasAccounting.latestIncomeAt ?? "—"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Прострочений графік оплат</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-[var(--enver-text)]">
              {formatMoneyUa(data.saasAccounting.overduePlanAmount)} грн
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Рядків: {data.saasAccounting.overduePlanCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Покриття поставок по PO</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-[var(--enver-text)]">
              {data.saasAccounting.procurementCoveragePct}%
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Комітмент: {formatMoneyUa(data.executive.procurementCommitted)} грн
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Індекс ризику</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-[var(--enver-text)]">
              {data.saasAccounting.riskIndex}/100
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{data.saasAccounting.riskLabel}</p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:col-span-2 xl:col-span-1">
            <p className="text-xs font-medium text-slate-500">Концентрація топ-постачальника</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-[var(--enver-text)]">
              {data.saasAccounting.topSupplierConcentrationPct}%
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Відкрита кредиторка: {formatMoneyUa(data.saasAccounting.openPayables)} грн
            </p>
          </div>
        </div>
      </SectionCard>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <SectionCard title="Старіння боргів" subtitle="Дебіторка та кредиторка за часовими кошиками">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Дебіторка
                </p>
                <div className="space-y-1 text-sm text-slate-700">
                  <p>Поточна: {formatMoneyUa(data.saasAccounting.receivablesByBucket.current)} грн</p>
                  <p>1-30 дн: {formatMoneyUa(data.saasAccounting.receivablesByBucket.d1_30)} грн</p>
                  <p>31-60 дн: {formatMoneyUa(data.saasAccounting.receivablesByBucket.d31_60)} грн</p>
                  <p>60+ дн: {formatMoneyUa(data.saasAccounting.receivablesByBucket.d60p)} грн</p>
                </div>
              </div>
              <div className="rounded-lg border border-rose-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
                  Кредиторка
                </p>
                <div className="space-y-1 text-sm text-slate-700">
                  <p>Поточна: {formatMoneyUa(data.saasAccounting.payablesByBucket.current)} грн</p>
                  <p>1-30 дн: {formatMoneyUa(data.saasAccounting.payablesByBucket.d1_30)} грн</p>
                  <p>31-60 дн: {formatMoneyUa(data.saasAccounting.payablesByBucket.d31_60)} грн</p>
                  <p>60+ дн: {formatMoneyUa(data.saasAccounting.payablesByBucket.d60p)} грн</p>
                </div>
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Стан проєктів" subtitle="Маржа, борги та сигнали ризику">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Проєкт</th>
                    <th className="px-2 py-2">Клієнт</th>
                    <th className="px-2 py-2">Маржа</th>
                    <th className="px-2 py-2">Простр. план</th>
                    <th className="px-2 py-2">Кредиторка</th>
                    <th className="px-2 py-2">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {data.saasAccounting.projectHealth.map((row) => (
                    <tr key={row.projectId} className="border-t border-slate-100">
                      <td className="px-2 py-2 font-medium text-[var(--enver-text)]">
                        {row.projectCode} · {row.projectTitle}
                      </td>
                      <td className="px-2 py-2 text-slate-600">{row.clientName}</td>
                      <td className="px-2 py-2">{row.marginPct}%</td>
                      <td className="px-2 py-2">{formatMoneyUa(row.overduePlanAmount)} грн</td>
                      <td className="px-2 py-2">{formatMoneyUa(row.payables)} грн</td>
                      <td className="px-2 py-2">
                        <StatusBadge
                          label={row.status === "ok" ? "Стабільно" : row.status === "warning" ? "Увага" : "Ризик"}
                          tone={row.status === "ok" ? "success" : row.status === "warning" ? "warning" : "danger"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
          <SectionCard title="Прогноз грошового потоку · 8 тижнів" subtitle="Плановий рух коштів (надходження/витрати/чистий потік)">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Тиждень</th>
                    <th className="px-2 py-2">Надходження</th>
                    <th className="px-2 py-2">Витрати</th>
                    <th className="px-2 py-2">Чистий потік</th>
                    <th className="px-2 py-2">Баланс</th>
                  </tr>
                </thead>
                <tbody>
                  {data.saasAccounting.cashflowForecast8w.map((row) => (
                    <tr key={row.week} className="border-t border-slate-100">
                      <td className="px-2 py-2 font-medium text-[var(--enver-text)]">{row.week}</td>
                      <td className="px-2 py-2">{formatMoneyUa(row.inflow)} грн</td>
                      <td className="px-2 py-2">{formatMoneyUa(row.outflow)} грн</td>
                      <td className="px-2 py-2">
                        <span className={row.net >= 0 ? "text-emerald-700" : "text-rose-700"}>
                          {formatMoneyUa(row.net)} грн
                        </span>
                      </td>
                      <td className="px-2 py-2">{formatMoneyUa(row.projectedBalance)} грн</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
          <SectionCard title="AR / AP ledger" subtitle="Дебіторка клієнтів і кредиторка постачальникам">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Дебіторка (AR)
                </p>
                <div className="max-h-64 space-y-1 overflow-y-auto text-xs">
                  {data.saasAccounting.arLedger.slice(0, 8).map((row) => (
                    <div key={row.projectId} className="rounded border border-emerald-100 bg-emerald-50/40 p-2">
                      <p className="font-medium text-slate-900">{row.projectCode} · {row.clientName}</p>
                      <p className="text-slate-600">
                        Виставлено {formatMoneyUa(row.invoiced)} · Оплачено {formatMoneyUa(row.received)} · До сплати {formatMoneyUa(row.outstanding)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-rose-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
                  Кредиторка (AP)
                </p>
                <div className="max-h-64 space-y-1 overflow-y-auto text-xs">
                  {data.saasAccounting.apLedger.slice(0, 8).map((row) => (
                    <div key={row.purchaseOrderId} className="rounded border border-rose-100 bg-rose-50/40 p-2">
                      <p className="font-medium text-slate-900">{row.orderNumber} · {row.supplierName}</p>
                      <p className="text-slate-600">
                        Всього {formatMoneyUa(row.total)} · Оплачено {formatMoneyUa(row.paid)} · До сплати {formatMoneyUa(row.outstanding)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
        <StickySidePanel>
          <FinanceSummaryPanel alerts={data.financeAlerts} />
        </StickySidePanel>
      </div>
        </>
      ) : null}
    </main>
  );
}
