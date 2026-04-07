import { CSV_UTF8_BOM, csvRow } from "../../../lib/csv";
import type { FinanceExecutiveKpi } from "./aggregation";
import { OPERATING_CASH_BUCKET_ORDER, OPERATING_CASH_BUCKET_UA } from "../types/models";
import type { FinanceTransaction, ProjectPaymentPlan } from "../types/models";
import { formatMoneyUa } from "./format-money";

/** Обмеження рядків транзакцій у браузерному експорті (захист від зависань). */
export const FINANCE_OVERVIEW_CSV_MAX_TRANSACTIONS = 12_000;

function m(v: number, fd: 0 | 2 = 0): string {
  return formatMoneyUa(v, fd);
}

export type FinanceOverviewCsvPayload = {
  referenceDay: string;
  dataSource: "mock" | "database";
  executiveKpi: FinanceExecutiveKpi;
  transactions: FinanceTransaction[];
  paymentPlan: ProjectPaymentPlan[];
  projectNameById: Record<string, string>;
  categoryNameById: Record<string, string>;
  accountLabelById: Record<string, string>;
};

export type FinanceOverviewCsvResult = {
  csv: string;
  /** Чи обрізано блок транзакцій до ліміту. */
  transactionsTruncated: boolean;
  transactionRowCount: number;
  transactionTotalCount: number;
};

export type BuildFinanceOverviewCsvOptions = {
  /**
   * Максимум рядків транзакцій у файлі.
   * `undefined` — ліміт для браузерного експорту (`FINANCE_OVERVIEW_CSV_MAX_TRANSACTIONS`).
   * `null` — усі транзакції (серверний повний експорт).
   */
  maxTransactions?: number | null;
};

export function buildFinanceOverviewCsvString(
  p: FinanceOverviewCsvPayload,
  options?: BuildFinanceOverviewCsvOptions,
): FinanceOverviewCsvResult {
  const lines: string[] = [];
  const totalTx = p.transactions.length;
  const cap =
    options?.maxTransactions === null
      ? null
      : (options?.maxTransactions ?? FINANCE_OVERVIEW_CSV_MAX_TRANSACTIONS);
  const txSlice =
    cap === null
      ? p.transactions
      : totalTx > cap
        ? p.transactions.slice(0, cap)
        : p.transactions;

  lines.push("# МЕТА");
  lines.push(csvRow(["Референсна дата (прострочення)", "Джерело даних"]));
  lines.push(csvRow([p.referenceDay, p.dataSource === "database" ? "PostgreSQL" : "Демо (mock)"]));
  lines.push(csvRow(["Транзакцій у файлі", String(txSlice.length)]));
  if (cap !== null && totalTx > txSlice.length) {
    lines.push(
      csvRow([
        "Увага",
        `У експорт потрапили перші ${txSlice.length} з ${totalTx} транзакцій (ліміт ${cap}).`,
      ]),
    );
  }

  lines.push("");
  lines.push("# ПОРТФЕЛЬ (executive KPI)");
  lines.push(csvRow(["Показник", "Значення (UAH)"]));
  const k = p.executiveKpi;
  const kpiRows: [string, number][] = [
    ["Портфель договорів", k.contractPortfolio],
    ["Отримано від клієнтів", k.receivedFromClients],
    ["Дебіторка", k.receivables],
    ["Кредиторка (PO)", k.payables],
    ["Грошові витрати (cash)", k.cashOperatingExpenses],
    ["План закупівель (позиції)", k.procurementPlanned],
    ["Факт позицій (accrual)", k.procurementAccrual],
    ["Зобовʼязання PO", k.procurementCommitted],
    ["Отримано по PO", k.procurementReceivedValue],
    ["Зарплата (облік)", k.payrollTotal],
    ["Комісії (облік)", k.commissionTotal],
    ["Валовий прибуток (cash)", k.grossProfitCash],
    ["Чистий прибуток (cash)", k.netProfitCash],
  ];
  for (const [label, val] of kpiRows) {
    lines.push(csvRow([label, m(val)]));
  }

  lines.push("");
  lines.push("# ВИТРАТИ ПО СТАТТЯХ (operating)");
  lines.push(csvRow(["Стаття", "Сума"]));
  for (const bucket of OPERATING_CASH_BUCKET_ORDER) {
    const v = k.operatingCashByBucket[bucket] ?? 0;
    if (v !== 0) lines.push(csvRow([OPERATING_CASH_BUCKET_UA[bucket], m(v)]));
  }

  lines.push("");
  lines.push("# ГРАФІК ОПЛАТ (портфель)");
  lines.push(csvRow(["Проєкт", "Назва", "Планова дата", "Сума", "Сплачено", "Статус"]));
  for (const pl of p.paymentPlan) {
    lines.push(
      csvRow([
        p.projectNameById[pl.projectId] ?? pl.projectId,
        pl.title,
        pl.plannedDate,
        m(pl.plannedAmount),
        m(pl.paidAmount),
        pl.status,
      ]),
    );
  }

  lines.push("");
  lines.push("# ТРАНЗАКЦІЇ");
  lines.push(
    csvRow([
      "Проєкт",
      "Дата",
      "Тип",
      "Стаття",
      "Рахунок",
      "Сума",
      "Валюта",
      "Документ",
      "Статус",
      "Коментар",
    ]),
  );
  for (const t of txSlice) {
    lines.push(
      csvRow([
        p.projectNameById[t.projectId] ?? t.projectId,
        t.transactionDate,
        t.type,
        p.categoryNameById[t.categoryId] ?? t.categoryId,
        t.accountId ? p.accountLabelById[t.accountId] ?? "" : "",
        m(t.amount, 2),
        t.currency,
        t.documentNumber,
        t.status,
        t.comment,
      ]),
    );
  }

  return {
    csv: CSV_UTF8_BOM + lines.join("\r\n"),
    transactionsTruncated: totalTx > txSlice.length,
    transactionRowCount: txSlice.length,
    transactionTotalCount: totalTx,
  };
}
