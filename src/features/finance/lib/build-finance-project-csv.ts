import { CSV_UTF8_BOM, csvRow } from "../../../lib/csv";
import { OPERATING_CASH_BUCKET_ORDER, OPERATING_CASH_BUCKET_UA } from "../types/models";
import type {
  FinanceTransaction,
  PayrollEntry,
  ProjectCommission,
  ProjectFinancialSummary,
  ProjectPaymentPlan,
} from "../types/models";
import { formatMoneyUa } from "./format-money";

export type FinanceProjectCsvPayload = {
  /** Для журналу експорту в ActivityLog. */
  projectId?: string;
  projectCode: string;
  projectTitle: string;
  clientName: string | null;
  summary: ProjectFinancialSummary;
  payrollSpreadsheet: {
    installation: number;
    assembly: number;
    constructor: number;
    manager: number;
    other: number;
  };
  paymentPlan: ProjectPaymentPlan[];
  transactions: FinanceTransaction[];
  payroll: PayrollEntry[];
  commissions: ProjectCommission[];
  categoryNameById: Record<string, string>;
  accountLabelById: Record<string, string>;
};

function money(v: number, fractionDigits: 0 | 2 = 0): string {
  return formatMoneyUa(v, fractionDigits);
}

export function buildFinanceProjectCsvString(p: FinanceProjectCsvPayload): string {
  const lines: string[] = [];

  lines.push("# ПРОЄКТ");
  lines.push(csvRow(["Код", "Назва", "Клієнт"]));
  lines.push(csvRow([p.projectCode, p.projectTitle, p.clientName ?? ""]));

  lines.push("");
  lines.push("# ЗВЕДЕННЯ");
  lines.push(csvRow(["Показник", "Значення (UAH)", "Примітка"]));
  const s = p.summary;
  const rows: [string, number | string, string][] = [
    ["Договірна сума", money(s.contractAmount), ""],
    ["Отримано від клієнта", money(s.receivedFromClient), ""],
    ["Борг клієнта", money(s.clientDebt), ""],
    ["Кредиторка (PO)", money(s.supplierDebt), ""],
    ["Грошові витрати (cash)", money(s.actualExpenses), "транзакції"],
    ["Валовий прибуток (спрощ.)", money(s.grossProfit), ""],
    ["Чистий прибуток", money(s.netProfit), ""],
    ["Зарплата (облік)", money(s.payrollTotal), ""],
    ["Комісії (облік)", money(s.commissionTotal), ""],
    ["План закупівель (позиції)", money(s.procurementPlanned), ""],
    ["Факт позицій (accrual)", money(s.procurementAccrual), ""],
    ["Зобовʼязання PO", money(s.procurementCommitted), ""],
    ["Отримано по PO", money(s.procurementReceivedValue), ""],
    ["Прострочення графіку (сума)", money(s.overduePlanAmount), `рядків: ${s.overduePlanCount}`],
  ];
  for (const [a, b, c] of rows) {
    lines.push(csvRow([a, b, c]));
  }

  lines.push("");
  lines.push("# ВИТРАТИ ПО СТАТТЯХ (operating)");
  lines.push(csvRow(["Стаття", "Сума"]));
  for (const bucket of OPERATING_CASH_BUCKET_ORDER) {
    const v = s.operatingCashByBucket[bucket] ?? 0;
    if (v !== 0) lines.push(csvRow([OPERATING_CASH_BUCKET_UA[bucket], money(v)]));
  }

  lines.push("");
  lines.push("# ЗП ПО РОЛЯХ (як у реєстрі)");
  lines.push(csvRow(["Установка/монтаж", "Збірка", "Конструктор", "Менеджер", "Інші"]));
  const py = p.payrollSpreadsheet;
  lines.push(
    csvRow([
      money(py.installation),
      money(py.assembly),
      money(py.constructor),
      money(py.manager),
      money(py.other),
    ]),
  );

  lines.push("");
  lines.push("# ГРАФІК ОПЛАТ");
  lines.push(csvRow(["Назва", "Планова дата", "Сума", "Сплачено", "Статус", "Коментар"]));
  for (const pl of p.paymentPlan) {
    lines.push(
      csvRow([
        pl.title,
        pl.plannedDate,
        money(pl.plannedAmount),
        money(pl.paidAmount),
        pl.status,
        pl.comment,
      ]),
    );
  }

  lines.push("");
  lines.push("# ТРАНЗАКЦІЇ");
  lines.push(
    csvRow([
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
  for (const t of p.transactions) {
    lines.push(
      csvRow([
        t.transactionDate,
        t.type,
        p.categoryNameById[t.categoryId] ?? t.categoryId,
        t.accountId ? p.accountLabelById[t.accountId] ?? "" : "",
        money(t.amount, 2),
        t.currency,
        t.documentNumber,
        t.status,
        t.comment,
      ]),
    );
  }

  lines.push("");
  lines.push("# ЗАРПЛАТА (рядки)");
  lines.push(csvRow(["Роль", "Сума", "Статус", "Дата оплати", "Коментар"]));
  for (const e of p.payroll) {
    lines.push(
      csvRow([
        e.roleType,
        money(e.amount),
        e.status,
        e.paymentDate ?? "",
        e.comment,
      ]),
    );
  }

  lines.push("");
  lines.push("# КОМІСІЇ");
  lines.push(csvRow(["База", "Сума", "Статус", "Коментар"]));
  for (const c of p.commissions) {
    lines.push(
      csvRow([c.baseType, money(c.calculatedAmount), c.status, c.comment]),
    );
  }

  return CSV_UTF8_BOM + lines.join("\r\n");
}

