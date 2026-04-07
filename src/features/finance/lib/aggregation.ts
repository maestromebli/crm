/**
 * ENVER CRM — фінансова агрегація (production-oriented).
 *
 * Шари (не змішувати):
 * 1) Транзакції фінансів — факт руху грошей (cash).
 * 2) План закупівель (ProcurementItem.planned*) — планування.
 * 3) Замовлення PO — зобовʼязання/комітмент перед постачальником.
 * 4) Рядки PO (receivedQty) — факт поставки в грошовому вираженні (не готівка).
 * 5) Позиції закупівель actualTotalCost — операційний облік «план/факт» по номенклатурі; не додаємо повторно до cash expense.
 */

import type {
  FinanceCategory,
  FinanceTransaction,
  OperatingCashBreakdown,
  PayrollEntry,
  ProjectCommission,
  ProjectFinancialSummary,
  ProjectPaymentPlan,
} from "../types/models";
import type { OperatingCashBucket } from "../types/models";
import type { ProcurementItem } from "../../procurement/types/models";
import type { PurchaseOrder, PurchaseOrderItem } from "../../procurement/types/models";
import type { Project } from "../../shared/types/entities";

const sum = (arr: number[]): number => arr.reduce((a, b) => a + b, 0);
const OPERATING_CASH_BUCKET_ORDER_LOCAL: OperatingCashBucket[] = [
  "MATERIALS",
  "SUBCONTRACTORS",
  "MEASURING",
  "CONSTRUCTOR",
  "ASSEMBLY",
  "INSTALLATION",
  "LOGISTICS",
  "PAYROLL",
  "COMMISSIONS",
];

function isRecordedFinance(tx: FinanceTransaction): boolean {
  return tx.status !== "CANCELLED";
}

export function emptyOperatingBreakdown(): OperatingCashBreakdown {
  const o = {} as OperatingCashBreakdown;
  for (const k of OPERATING_CASH_BUCKET_ORDER_LOCAL) {
    o[k] = 0;
  }
  return o;
}

/**
 * Розкладка грошових витрат по статтях (EXPENSE / PAYROLL / COMMISSION за категорією).
 * Не включає закупівельні позиції — лише транзакції модуля фінансів.
 */
export function buildOperatingCashBreakdown(
  transactions: FinanceTransaction[],
  categories: FinanceCategory[],
): OperatingCashBreakdown {
  const cat = new Map(categories.map((c) => [c.id, c]));
  const out = emptyOperatingBreakdown();
  for (const t of transactions.filter(isRecordedFinance)) {
    if (t.type !== "EXPENSE" && t.type !== "PAYROLL" && t.type !== "COMMISSION") continue;
    const c = cat.get(t.categoryId);
    const bucket = c?.operatingBucket;
    if (!bucket) continue;
    out[bucket] += t.amount;
  }
  return out;
}

/** Грошові витрати з модуля фінансів (без дублювання закупівель з позицій). */
export function sumCashOperatingOutflow(transactions: FinanceTransaction[]): number {
  return sum(
    transactions
      .filter(isRecordedFinance)
      .filter((t) => t.type === "EXPENSE" || t.type === "PAYROLL" || t.type === "COMMISSION")
      .map((t) => t.amount),
  );
}

export function sumClientIncome(transactions: FinanceTransaction[]): number {
  return sum(
    transactions.filter(isRecordedFinance).filter((t) => t.type === "INCOME").map((t) => t.amount),
  );
}

/** План закупівель по позиціях (шар планування). */
export function sumProcurementPlanned(items: ProcurementItem[]): number {
  return sum(items.map((i) => i.plannedTotalCost));
}

/** Факт закупівель по позиціях (операційний облік номенклатури). */
export function sumProcurementAccrual(items: ProcurementItem[]): number {
  return sum(items.map((i) => i.actualTotalCost ?? i.plannedTotalCost));
}

/** Кредиторка: відкриті зобовʼязання по PO (не сплачено і не скасовано). */
export function sumSupplierPayables(orders: PurchaseOrder[]): number {
  return sum(
    orders
      .filter((o) => o.status !== "PAID" && o.status !== "CANCELLED")
      .map((o) => o.totalAmount),
  );
}

/** Сума підтверджених замовлень (комітмент), без чернеток і скасованих. */
export function sumPurchaseOrderCommitment(orders: PurchaseOrder[]): number {
  return sum(
    orders
      .filter((o) => o.status !== "CANCELLED" && o.status !== "DRAFT")
      .map((o) => o.totalAmount),
  );
}

/** Вартість отриманого по рядках PO: receivedQty × price (шар поставки). */
export function sumReceivedValueFromPoItems(
  items: PurchaseOrderItem[],
  purchaseOrderIds: string[],
): number {
  const set = new Set(purchaseOrderIds);
  return sum(
    items
      .filter((i) => set.has(i.purchaseOrderId))
      .map((i) => i.receivedQty * i.price),
  );
}

/** Чи рядок графіку оплат прострочений (для фільтрів у UI). */
export function isPaymentPlanOverdue(
  p: ProjectPaymentPlan,
  referenceDay: string,
): boolean {
  if (p.status === "CANCELLED") return false;
  const remaining = Math.max(p.plannedAmount - p.paidAmount, 0);
  if (remaining <= 0) return false;
  return p.status === "OVERDUE" || p.plannedDate < referenceDay;
}

/** Прострочення графіку: залишок до сплати по рядках зі статусом OVERDUE або датою < referenceDay. */
export function paymentPlanOverdueStats(
  planRows: ProjectPaymentPlan[],
  referenceDay: string,
): { overduePlanAmount: number; overduePlanCount: number } {
  let overduePlanAmount = 0;
  let overduePlanCount = 0;
  for (const p of planRows) {
    if (!isPaymentPlanOverdue(p, referenceDay)) continue;
    overduePlanCount += 1;
    overduePlanAmount += Math.max(p.plannedAmount - p.paidAmount, 0);
  }
  return { overduePlanAmount, overduePlanCount };
}

export type FinanceExecutiveKpi = {
  contractPortfolio: number;
  receivedFromClients: number;
  receivables: number;
  payables: number;
  cashOperatingExpenses: number;
  procurementPlanned: number;
  procurementAccrual: number;
  procurementCommitted: number;
  procurementReceivedValue: number;
  payrollTotal: number;
  commissionTotal: number;
  grossProfitCash: number;
  netProfitCash: number;
  operatingCashByBucket: OperatingCashBreakdown;
};

export function buildExecutiveKpi(
  projects: Project[],
  transactions: FinanceTransaction[],
  payroll: PayrollEntry[],
  commissions: ProjectCommission[],
  procurementItems: ProcurementItem[],
  purchaseOrders: PurchaseOrder[],
  purchaseOrderItems: PurchaseOrderItem[],
  categories: FinanceCategory[],
): FinanceExecutiveKpi {
  const contractPortfolio = sum(projects.map((p) => p.contractAmount));
  const receivedFromClients = sumClientIncome(transactions);
  const cashOperatingExpenses = sumCashOperatingOutflow(transactions);
  const payrollTotal = sum(payroll.filter((p) => p.status !== "CANCELLED").map((p) => p.amount));
  const commissionTotal = sum(
    commissions.filter((c) => c.status !== "CANCELLED").map((c) => c.calculatedAmount),
  );
  const procurementPlanned = sumProcurementPlanned(procurementItems);
  const procurementAccrual = sumProcurementAccrual(procurementItems);
  const procurementCommitted = sumPurchaseOrderCommitment(purchaseOrders);
  const procurementReceivedValue = sumReceivedValueFromPoItems(
    purchaseOrderItems,
    purchaseOrders.map((o) => o.id),
  );
  const payables = sumSupplierPayables(purchaseOrders);
  const operatingCashByBucket = buildOperatingCashBreakdown(transactions, categories);

  const receivables = Math.max(contractPortfolio - receivedFromClients, 0);

  const payrollInCash = sum(
    transactions
      .filter(isRecordedFinance)
      .filter((t) => t.type === "PAYROLL")
      .map((t) => t.amount),
  );
  const commissionInCash = sum(
    transactions
      .filter(isRecordedFinance)
      .filter((t) => t.type === "COMMISSION")
      .map((t) => t.amount),
  );

  const expenseCashOnly = sum(
    transactions
      .filter(isRecordedFinance)
      .filter((t) => t.type === "EXPENSE")
      .map((t) => t.amount),
  );

  const grossProfitCash = contractPortfolio - expenseCashOnly;
  const netProfitCash = grossProfitCash - payrollInCash - commissionInCash;

  return {
    contractPortfolio,
    receivedFromClients,
    receivables,
    payables,
    cashOperatingExpenses,
    procurementPlanned,
    procurementAccrual,
    procurementCommitted,
    procurementReceivedValue,
    payrollTotal,
    commissionTotal,
    grossProfitCash,
    netProfitCash,
    operatingCashByBucket,
  };
}

export function calculateProjectSummary(
  project: Project,
  paymentPlan: ProjectPaymentPlan[],
  transactions: FinanceTransaction[],
  payroll: PayrollEntry[],
  commissions: ProjectCommission[],
  procurementItems: ProcurementItem[],
  purchaseOrders: PurchaseOrder[],
  purchaseOrderItems: PurchaseOrderItem[],
  categories: FinanceCategory[],
  referenceDay: string,
): ProjectFinancialSummary {
  const tx = transactions.filter((t) => t.projectId === project.id);
  const pp = paymentPlan.filter((p) => p.projectId === project.id);
  const py = payroll.filter((p) => p.projectId === project.id);
  const cm = commissions.filter((c) => c.projectId === project.id);
  const pr = procurementItems.filter((i) => i.projectId === project.id);
  const po = purchaseOrders.filter((o) => o.projectId === project.id);
  const poIds = po.map((o) => o.id);

  const receivedFromClient = sumClientIncome(tx);
  const payrollRecorded = sum(py.filter((p) => p.status !== "CANCELLED").map((p) => p.amount));
  const commissionRecorded = sum(cm.filter((c) => c.status !== "CANCELLED").map((c) => c.calculatedAmount));

  const expenseCash = sum(
    tx.filter(isRecordedFinance).filter((t) => t.type === "EXPENSE").map((t) => t.amount),
  );
  const payrollCash = sum(
    tx.filter(isRecordedFinance).filter((t) => t.type === "PAYROLL").map((t) => t.amount),
  );
  const commissionCash = sum(
    tx.filter(isRecordedFinance).filter((t) => t.type === "COMMISSION").map((t) => t.amount),
  );

  const actualCashExpenses = expenseCash + payrollCash + commissionCash;
  const operatingCashByBucket = buildOperatingCashBreakdown(tx, categories);

  const procurementPlanned = sum(pr.map((i) => i.plannedTotalCost));
  const procurementAccrual = sum(pr.map((i) => i.actualTotalCost ?? i.plannedTotalCost));

  const plannedExpenses =
    procurementPlanned +
    sum(py.filter((p) => p.status !== "CANCELLED").map((p) => p.amount)) +
    sum(cm.filter((c) => c.status !== "CANCELLED").map((c) => c.calculatedAmount));

  const outstandingFromClient = Math.max(project.contractAmount - receivedFromClient, 0);
  const supplierDebt = sumSupplierPayables(po);
  const clientDebt = outstandingFromClient;

  const procurementCommitted = sumPurchaseOrderCommitment(po);
  const procurementReceivedValue = sumReceivedValueFromPoItems(purchaseOrderItems, poIds);

  const { overduePlanAmount, overduePlanCount } = paymentPlanOverdueStats(pp, referenceDay);

  const grossProfit = project.contractAmount - expenseCash;
  const netProfit = grossProfit - payrollCash - commissionCash;

  return {
    projectId: project.id,
    contractAmount: project.contractAmount,
    plannedExpenses,
    actualExpenses: actualCashExpenses,
    receivedFromClient,
    outstandingFromClient,
    grossProfit,
    netProfit,
    payrollTotal: payrollRecorded,
    commissionTotal: commissionRecorded,
    supplierDebt,
    clientDebt,
    lastCalculatedAt: new Date().toISOString(),
    procurementPlanned,
    procurementAccrual,
    cashExpense: expenseCash,
    operatingCashByBucket,
    procurementCommitted,
    procurementReceivedValue,
    overduePlanAmount,
    overduePlanCount,
  };
}

/** Сумарний рядок по всіх відрах — для executive dashboard. */
export function sumOperatingBreakdown(b: OperatingCashBreakdown): number {
  return sum(OPERATING_CASH_BUCKET_ORDER_LOCAL.map((k) => b[k]));
}
