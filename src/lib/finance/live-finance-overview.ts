import type { MoneyTransaction, MoneyTransactionCategory, MoneyTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FinanceCategory, FinanceTransaction, FinanceTransactionStatus } from "@/features/finance/types/models";
import type { FinanceTransactionType } from "@/features/finance/types/models";
import type { PayrollEntry as UiPayroll } from "@/features/finance/types/models";
import type { ProjectCommission } from "@/features/finance/types/models";
import type { ProjectPaymentPlan } from "@/features/finance/types/models";
import type { ProcurementItem } from "@/features/procurement/types/models";
import type { PurchaseOrder as UiPurchaseOrder } from "@/features/procurement/types/models";
import type { PurchaseOrderItem } from "@/features/procurement/types/models";
import type { Project, ProjectObject } from "@/features/shared/types/entities";
import {
  buildExecutiveKpi,
  calculateProjectSummary,
  paymentPlanOverdueStats,
} from "@/features/finance/lib/aggregation";
import { buildObjectFinanceLedger, consolidateObjectLedger } from "@/features/finance/lib/object-finance";
import { FINANCE_ACCOUNT_CATALOG, FINANCE_CATEGORY_CATALOG } from "@/lib/finance/finance-dictionaries";
import { moneyFromDb } from "@/lib/finance/money";

function mapFinanceTxStatus(raw: string): FinanceTransactionStatus {
  if (raw === "CANCELLED") return "CANCELLED";
  if (raw === "CONFIRMED") return "CONFIRMED";
  return "DRAFT";
}

function mapFinanceTxType(raw: string): FinanceTransactionType {
  const u = raw.toUpperCase();
  if (u === "INCOME" || u === "EXPENSE" || u === "PAYROLL" || u === "COMMISSION" || u === "TRANSFER" || u === "REFUND") {
    return u as FinanceTransactionType;
  }
  return "EXPENSE";
}

function categoryIdForMoneyTx(category: MoneyTransactionCategory, type: MoneyTransactionType): string {
  if (type === "INCOME") {
    if (category === "PREPAYMENT") return "fc-001";
    if (category === "FINAL_PAYMENT") return "fc-003";
    return "fc-002";
  }
  if (category === "MATERIALS") return "fc-004";
  if (category === "SALARY") return "fc-011";
  return "fc-004";
}

function categoryIdForFinanceCategoryString(cat: string, txType: FinanceTransactionType): string {
  const c = cat.toLowerCase();
  if (txType === "PAYROLL") return "fc-011";
  if (txType === "COMMISSION") return "fc-012";
  if (c.includes("логіст")) return "fc-006";
  if (c.includes("підряд")) return "fc-005";
  if (c.includes("замір")) return "fc-007";
  if (c.includes("конструктор")) return "fc-008";
  if (c.includes("збір")) return "fc-009";
  if (c.includes("монтаж") || c.includes("установ")) return "fc-010";
  return "fc-004";
}

function moneyTxToUi(mt: MoneyTransaction): FinanceTransaction {
  const t: FinanceTransactionType = mt.type === "INCOME" ? "INCOME" : "EXPENSE";
  return {
    id: `mt-${mt.id}`,
    projectId: mt.dealId,
    objectId: null,
    type: t,
    categoryId: categoryIdForMoneyTx(mt.category, mt.type),
    accountId: "fa-002",
    counterpartyType: t === "INCOME" ? "CLIENT" : "SUPPLIER",
    counterpartyId: null,
    amount: moneyFromDb(mt.amount),
    currency: (mt.currency as "UAH") ?? "UAH",
    transactionDate: (mt.paidAt ?? mt.createdAt).toISOString().slice(0, 10),
    paymentMethod: "",
    documentNumber: mt.description?.slice(0, 64) ?? "",
    status: mt.status === "PAID" ? "CONFIRMED" : mt.status === "CANCELLED" ? "CANCELLED" : "DRAFT",
    comment: mt.description ?? "",
    createdById: mt.createdById,
  };
}

function financeTxToUi(ft: {
  id: string;
  dealId: string;
  type: string;
  amount: unknown;
  date: Date;
  status: string;
  category: string;
}): FinanceTransaction {
  const txType = mapFinanceTxType(ft.type);
  return {
    id: `ft-${ft.id}`,
    projectId: ft.dealId,
    objectId: null,
    type: txType,
    categoryId: categoryIdForFinanceCategoryString(ft.category, txType),
    accountId: "fa-002",
    counterpartyType: txType === "INCOME" ? "CLIENT" : "SUPPLIER",
    counterpartyId: null,
    amount: moneyFromDb(ft.amount),
    currency: "UAH",
    transactionDate: ft.date.toISOString().slice(0, 10),
    paymentMethod: "",
    documentNumber: "",
    status: mapFinanceTxStatus(ft.status),
    comment: ft.category,
    createdById: null,
  };
}

function normalizePoStatus(s: string): UiPurchaseOrder["status"] {
  const u = s.toUpperCase();
  if (u === "DRAFT") return "DRAFT";
  if (u === "SENT") return "SENT";
  if (u === "CONFIRMED" || u === "PARTIAL") return "CONFIRMED";
  if (u === "PAID") return "PAID";
  if (u === "DELIVERED") return "DELIVERED";
  if (u === "CANCELLED") return "CANCELLED";
  return "CONFIRMED";
}

function buildProjectsFromDeals(
  deals: Array<{
    id: string;
    title: string;
    value: unknown;
    expectedCloseDate: Date | null;
    clientId: string;
    ownerId: string;
    projects: Array<{ id: string; code: string | null; title: string | null }>;
  }>,
): Project[] {
  return deals.map((d) => ({
    id: d.id,
    code: d.projects[0]?.code?.trim() || d.id.slice(0, 8),
    title: d.title,
    clientId: d.clientId,
    managerId: d.ownerId,
    status: "IN_WORK",
    contractAmount: moneyFromDb(d.value),
    currency: "UAH",
    plannedMargin: null,
    actualMargin: null,
    startDate: null,
    dueDate: d.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
    notes: "",
  }));
}

function buildObjectsFromDeals(
  deals: Array<{
    id: string;
    title: string;
    projects: Array<{ id: string; code: string | null; title: string | null }>;
  }>,
): ProjectObject[] {
  const out: ProjectObject[] = [];
  for (const d of deals) {
    if (d.projects.length === 0) {
      out.push({
        id: `${d.id}-default-obj`,
        projectId: d.id,
        title: d.title,
        objectType: "Об'єкт",
        address: "—",
        notes: "",
      });
      continue;
    }
    for (const p of d.projects) {
      out.push({
        id: p.id,
        projectId: d.id,
        title: p.title?.trim() || "Об'єкт",
        objectType: "Адреса",
        address: p.code?.trim() || "—",
        notes: "",
      });
    }
  }
  return out;
}

function mapPayrollRows(
  rows: Array<{ id: string; dealId: string; employeeId: string; amount: unknown; type: string; status: string }>,
): UiPayroll[] {
  return rows.map((p) => ({
    id: p.id,
    projectId: p.dealId,
    objectId: null,
    employeeId: p.employeeId,
    roleType: p.type,
    calcType: "FIXED",
    baseAmount: null,
    percent: null,
    amount: moneyFromDb(p.amount),
    status: p.status as UiPayroll["status"],
    paymentDate: null,
    comment: "",
  }));
}

function mapCommissionRows(
  rows: Array<{ id: string; dealId: string; userId: string; amount: unknown; percent: unknown; status: string }>,
): ProjectCommission[] {
  return rows.map((c) => ({
    id: c.id,
    projectId: c.dealId,
    recipientType: "MANAGER",
    recipientId: c.userId,
    baseType: "CONTRACT",
    baseAmount: 0,
    percent: c.percent != null ? moneyFromDb(c.percent) : null,
    fixedAmount: moneyFromDb(c.amount),
    calculatedAmount: moneyFromDb(c.amount),
    status: c.status as ProjectCommission["status"],
    paymentDate: null,
    comment: "",
  }));
}

function mapPaymentPlanRows(
  rows: Array<{ id: string; dealId: string | null; amount: unknown; remainingAmount: unknown | null; dueDate: Date; status: string }>,
): ProjectPaymentPlan[] {
  return rows
    .filter((r) => r.dealId)
    .map((r) => {
      const amt = moneyFromDb(r.amount);
      const rem = moneyFromDb(r.remainingAmount);
      const paid = Math.max(amt - rem, 0);
      return {
        id: r.id,
        projectId: r.dealId as string,
        title: "Графік оплат",
        plannedDate: r.dueDate.toISOString().slice(0, 10),
        plannedAmount: amt,
        paidAmount: paid,
        status: r.status as ProjectPaymentPlan["status"],
        comment: "",
      };
    });
}

function mapProcurementItems(
  rows: Array<{
    id: string;
    requestId: string;
    name: string | null;
    costPlanned: unknown;
    costActual: unknown;
    status: string | null;
    request: { dealId: string };
  }>,
): ProcurementItem[] {
  return rows.map((it) => {
    const planned = moneyFromDb(it.costPlanned);
    const actual = moneyFromDb(it.costActual);
    return {
      id: it.id,
      requestId: it.requestId,
      projectId: it.request.dealId,
      objectId: null,
      categoryId: "pc-001",
      itemType: "MATERIAL",
      name: it.name?.trim() || "Позиція",
      article: null,
      unit: "шт",
      qty: 1,
      plannedUnitCost: planned,
      plannedTotalCost: planned,
      actualUnitCost: actual,
      actualTotalCost: actual,
      supplierId: null,
      status: (it.status as ProcurementItem["status"]) ?? "APPROVED",
      isCustom: false,
      comment: "",
    };
  });
}

function mapPurchaseOrders(
  rows: Array<{ id: string; dealId: string; totalAmount: unknown; status: string; expectedDate: Date | null; createdAt: Date }>,
): UiPurchaseOrder[] {
  return rows.map((po) => ({
    id: po.id,
    supplierId: po.dealId,
    projectId: po.dealId,
    requestId: null,
    orderNumber: `PO-${po.id.slice(0, 8)}`,
    status: normalizePoStatus(po.status),
    orderDate: po.createdAt.toISOString().slice(0, 10),
    expectedDate: po.expectedDate?.toISOString().slice(0, 10) ?? null,
    totalAmount: moneyFromDb(po.totalAmount),
    comment: "",
  }));
}

function receivablesPayablesBuckets(
  planRows: ProjectPaymentPlan[],
  referenceDay: string,
  purchaseOrders: UiPurchaseOrder[],
  financeExpenseRows: FinanceTransaction[],
  invoiceRows: Array<{ amount: unknown; dueDate: Date | null }>,
) {
  const receivablesByBucket = { current: 0, d1_30: 0, d31_60: 0, d60p: 0 };
  const ref = new Date(`${referenceDay}T12:00:00`);
  for (const p of planRows) {
    const remaining = Math.max(p.plannedAmount - p.paidAmount, 0);
    if (remaining <= 0) continue;
    const due = new Date(`${p.plannedDate}T12:00:00`);
    const days = Math.floor((ref.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
    if (days <= 0) receivablesByBucket.current += remaining;
    else if (days <= 30) receivablesByBucket.d1_30 += remaining;
    else if (days <= 60) receivablesByBucket.d31_60 += remaining;
    else receivablesByBucket.d60p += remaining;
  }

  const payablesByBucket = { current: 0, d1_30: 0, d31_60: 0, d60p: 0 };
  for (const po of purchaseOrders) {
    if (po.status === "CANCELLED" || po.status === "PAID") continue;
    const amount = po.totalAmount;
    const eta = po.expectedDate ? new Date(`${po.expectedDate}T12:00:00`) : null;
    if (!eta) {
      payablesByBucket.current += amount;
      continue;
    }
    const days = Math.floor((ref.getTime() - eta.getTime()) / (24 * 60 * 60 * 1000));
    if (days <= 0) payablesByBucket.current += amount;
    else if (days <= 30) payablesByBucket.d1_30 += amount;
    else if (days <= 60) payablesByBucket.d31_60 += amount;
    else payablesByBucket.d60p += amount;
  }
  for (const inv of invoiceRows) {
    if (!inv.dueDate) continue;
    const amount = moneyFromDb(inv.amount);
    const due = inv.dueDate;
    const days = Math.floor((ref.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
    if (days <= 0) continue;
    if (days <= 30) payablesByBucket.d1_30 += amount;
    else if (days <= 60) payablesByBucket.d31_60 += amount;
    else payablesByBucket.d60p += amount;
  }
  for (const tx of financeExpenseRows) {
    if (tx.type !== "EXPENSE" || tx.status === "CANCELLED") continue;
    const amount = tx.amount;
    const due = new Date(`${tx.transactionDate}T12:00:00`);
    const days = Math.floor((ref.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
    if (days <= 0) continue;
    if (days <= 30) payablesByBucket.d1_30 += amount;
    else if (days <= 60) payablesByBucket.d31_60 += amount;
    else payablesByBucket.d60p += amount;
  }

  return { receivablesByBucket, payablesByBucket };
}

function cashflowForecastFromBalance(
  balance: number,
  avgInflowWeek: number,
  avgOutflowWeek: number,
): Array<{ week: string; inflow: number; outflow: number; net: number; projectedBalance: number }> {
  return Array.from({ length: 8 }).map((_, index) => {
    const weekNo = index + 1;
    const inflow = Math.round(avgInflowWeek * (1 + (index % 3 === 0 ? 0.06 : 0)));
    const outflow = Math.round(avgOutflowWeek * (1 + (index % 4 === 1 ? 0.05 : 0)));
    const net = inflow - outflow;
    return {
      week: `W${weekNo}`,
      inflow,
      outflow,
      net,
      projectedBalance: Math.round(balance + net * weekNo),
    };
  });
}

export async function loadLiveFinanceOverview() {
  const referenceDay = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    deals,
    moneyTxAll,
    financeTxAll,
    payrollRows,
    commissionRows,
    paymentPlanDb,
    procurementItemRows,
    purchaseOrderRows,
    invoicesOpen,
    dealPurchaseOrders,
    suppliers,
  ] = await Promise.all([
    prisma.deal.findMany({
      where: { status: { in: ["OPEN", "WON"] } },
      select: {
        id: true,
        title: true,
        value: true,
        expectedCloseDate: true,
        clientId: true,
        ownerId: true,
        client: { select: { id: true, name: true } },
        projects: { select: { id: true, code: true, title: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.moneyTransaction.findMany({
      select: {
        id: true,
        dealId: true,
        type: true,
        category: true,
        amount: true,
        currency: true,
        status: true,
        paidAt: true,
        createdAt: true,
        description: true,
        createdById: true,
      },
    }),
    prisma.financeTransaction.findMany({
      select: {
        id: true,
        dealId: true,
        type: true,
        amount: true,
        date: true,
        status: true,
        category: true,
      },
    }),
    prisma.payrollEntry.findMany({
      select: { id: true, dealId: true, employeeId: true, amount: true, type: true, status: true },
    }),
    prisma.commission.findMany({
      select: { id: true, dealId: true, userId: true, amount: true, percent: true, status: true },
    }),
    prisma.paymentPlanEntry.findMany({
      where: { dealId: { not: null } },
      select: { id: true, dealId: true, amount: true, remainingAmount: true, dueDate: true, status: true },
    }),
    prisma.procurementRequestItem.findMany({
      select: {
        id: true,
        requestId: true,
        name: true,
        costPlanned: true,
        costActual: true,
        status: true,
        request: { select: { dealId: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      select: { id: true, dealId: true, totalAmount: true, status: true, expectedDate: true, createdAt: true },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["DRAFT", "SENT"] } },
      select: { amount: true, dueDate: true },
    }),
    prisma.dealPurchaseOrder.findMany({
      select: { id: true, supplierId: true, dealId: true, total: true, status: true },
    }),
    prisma.supplier.findMany({ select: { id: true, name: true } }),
  ]);

  const categories: FinanceCategory[] = FINANCE_CATEGORY_CATALOG;
  const accounts = FINANCE_ACCOUNT_CATALOG;

  const projects = buildProjectsFromDeals(deals);
  const objects = buildObjectsFromDeals(deals);

  const moneyUi = moneyTxAll.map(moneyTxToUi);
  const financeUi = financeTxAll.map(financeTxToUi);
  const payrollUi = mapPayrollRows(payrollRows);
  const commissionUi = mapCommissionRows(commissionRows);

  const payrollAsTx: FinanceTransaction[] = payrollRows.map((p) => ({
    id: `pe-${p.id}`,
    projectId: p.dealId,
    objectId: null,
    type: "PAYROLL",
    categoryId: "fc-011",
    accountId: "fa-002",
    counterpartyType: "EMPLOYEE",
    counterpartyId: p.employeeId,
    amount: moneyFromDb(p.amount),
    currency: "UAH",
    transactionDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "",
    documentNumber: "",
    status: p.status === "PAID" ? "CONFIRMED" : "DRAFT",
    comment: p.type,
    createdById: null,
  }));

  const commissionAsTx: FinanceTransaction[] = commissionRows.map((c) => ({
    id: `cm-${c.id}`,
    projectId: c.dealId,
    objectId: null,
    type: "COMMISSION",
    categoryId: "fc-012",
    accountId: "fa-002",
    counterpartyType: "PARTNER",
    counterpartyId: c.userId,
    amount: moneyFromDb(c.amount),
    currency: "UAH",
    transactionDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "",
    documentNumber: "",
    status: c.status === "PAID" ? "CONFIRMED" : "DRAFT",
    comment: "",
    createdById: null,
  }));

  const transactions: FinanceTransaction[] = [
    ...moneyUi,
    ...financeUi,
    ...payrollAsTx,
    ...commissionAsTx,
  ].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));

  const paymentPlan = mapPaymentPlanRows(paymentPlanDb);
  const procurementItems = mapProcurementItems(procurementItemRows);
  const purchaseOrdersUi = mapPurchaseOrders(purchaseOrderRows);
  const emptyPoItems: PurchaseOrderItem[] = [];

  const executive = buildExecutiveKpi(
    projects,
    transactions,
    payrollUi,
    commissionUi,
    procurementItems,
    purchaseOrdersUi,
    emptyPoItems,
    categories,
  );

  const kpi = {
    revenue: executive.contractPortfolio,
    received: executive.receivedFromClients,
    clientDebt: executive.receivables,
    expenses: executive.cashOperatingExpenses,
    grossProfit: executive.grossProfitCash,
    netProfit: executive.netProfitCash,
  };

  const overduePlan = paymentPlanOverdueStats(paymentPlan, referenceDay);

  const paidMoney = moneyTxAll.filter((t) => t.status === "PAID");
  const latestIncomeAt = paidMoney
    .filter((t) => t.type === "INCOME")
    .sort((a, b) => (b.paidAt ?? b.createdAt).getTime() - (a.paidAt ?? a.createdAt).getTime())[0];
  const latestIncomeStr = latestIncomeAt ? (latestIncomeAt.paidAt ?? latestIncomeAt.createdAt).toISOString().slice(0, 10) : null;

  let incomeMonth = 0;
  let expenseMonth = 0;
  for (const t of moneyTxAll) {
    const dt = t.paidAt ?? t.createdAt;
    if (dt < monthStart) continue;
    const amount = moneyFromDb(t.amount);
    if (t.type === "INCOME" && t.status === "PAID") incomeMonth += amount;
    if (t.type === "EXPENSE" && t.status === "PAID") expenseMonth += amount;
  }

  const monthlyExpense = Math.max(1, expenseMonth > 0 ? expenseMonth : executive.cashOperatingExpenses / 12);
  const baselineBalance = executive.receivedFromClients - executive.cashOperatingExpenses;
  const cashRunwayDays = Math.round((baselineBalance / monthlyExpense) * 30);

  const coveragePct =
    executive.procurementCommitted > 0
      ? (executive.procurementReceivedValue / executive.procurementCommitted) * 100
      : 100;

  const supplierSpend = new Map<string, number>();
  for (const dpo of dealPurchaseOrders) {
    if (dpo.status === "CANCELLED") continue;
    const sid = dpo.supplierId;
    supplierSpend.set(sid, (supplierSpend.get(sid) ?? 0) + moneyFromDb(dpo.total));
  }
  const totals = [...supplierSpend.values()];
  const totalSupplierSpend = totals.reduce((a, b) => a + b, 0);
  const topSupplierShare =
    totalSupplierSpend > 0 ? (Math.max(...totals) / totalSupplierSpend) * 100 : 0;

  const { receivablesByBucket, payablesByBucket } = receivablesPayablesBuckets(
    paymentPlan,
    referenceDay,
    purchaseOrdersUi,
    financeUi.filter((t) => t.type === "EXPENSE"),
    invoicesOpen,
  );

  const arLedger = projects
    .map((project) => {
      const invoiced = project.contractAmount;
      const received = paidMoney
        .filter((t) => t.dealId === project.id && t.type === "INCOME")
        .reduce((acc, t) => acc + moneyFromDb(t.amount), 0);
      const outstanding = Math.max(invoiced - received, 0);
      const client = deals.find((d) => d.id === project.id)?.client;
      return {
        projectId: project.id,
        projectCode: project.code,
        projectTitle: project.title,
        clientName: client?.name ?? "—",
        invoiced,
        received,
        outstanding,
        dueDate: project.dueDate,
      };
    })
    .filter((row) => row.invoiced > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  const supplierNameById = new Map(suppliers.map((s) => [s.id, s.name]));
  const apLedger = dealPurchaseOrders
    .filter((po) => po.status !== "CANCELLED")
    .map((po) => ({
      purchaseOrderId: po.id,
      orderNumber: po.id.slice(0, 12),
      supplierName: supplierNameById.get(po.supplierId) ?? "—",
      total: moneyFromDb(po.total),
      paid: po.status === "DELIVERED" || po.status === "ORDERED" ? moneyFromDb(po.total) : 0,
      outstanding:
        po.status === "DELIVERED" || po.status === "ORDERED" ? 0 : moneyFromDb(po.total),
      expectedDate: null as string | null,
      status: po.status,
    }))
    .sort((a, b) => b.outstanding - a.outstanding);

  const recentPaid = paidMoney
    .slice()
    .sort((a, b) => (a.paidAt ?? a.createdAt).getTime() - (b.paidAt ?? b.createdAt).getTime())
    .slice(-90);
  const avgIncomeDaily =
    recentPaid.filter((t) => t.type === "INCOME").reduce((a, t) => a + moneyFromDb(t.amount), 0) / 90;
  const avgExpenseDaily =
    recentPaid.filter((t) => t.type === "EXPENSE").reduce((a, t) => a + moneyFromDb(t.amount), 0) / 90;
  const cashflowForecast8w = cashflowForecastFromBalance(
    baselineBalance,
    Math.max(avgIncomeDaily * 7, 1),
    Math.max(avgExpenseDaily * 7, 1),
  );

  const riskIndex = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (overduePlan.overduePlanAmount > 0 ? 35 : 0) +
          (topSupplierShare > 45 ? 20 : 8) +
          (coveragePct < 65 ? 20 : 8) +
          (executive.receivables > executive.contractPortfolio * 0.35 ? 15 : 5) +
          (baselineBalance < 0 ? 10 : 3),
      ),
    ),
  );
  const riskLabel = riskIndex >= 70 ? "Критичний" : riskIndex >= 45 ? "Підвищений" : "Контрольований";

  const objectLedger = buildObjectFinanceLedger(
    projects,
    objects,
    transactions,
    procurementItems,
    purchaseOrdersUi,
    payrollUi,
  );
  const objectLedgerConsolidated = consolidateObjectLedger(objectLedger);

  const projectHealth = projects.map((project) => {
    const summary = calculateProjectSummary(
      project,
      paymentPlan,
      transactions,
      payrollUi,
      commissionUi,
      procurementItems,
      purchaseOrdersUi,
      emptyPoItems,
      categories,
      referenceDay,
    );
    const client = deals.find((d) => d.id === project.id)?.client;
    return {
      projectId: project.id,
      projectCode: project.code,
      projectTitle: project.title,
      clientName: client?.name ?? "—",
      marginPct:
        project.contractAmount > 0
          ? Number(((summary.netProfit / project.contractAmount) * 100).toFixed(1))
          : 0,
      overduePlanAmount: summary.overduePlanAmount,
      payables: summary.supplierDebt,
      status:
        summary.overduePlanAmount > 0 ? "risk" : summary.netProfit < 0 ? "warning" : "ok",
    };
  });

  const alerts: Array<{ level: "P0" | "P1" | "P2"; text: string }> = [];
  if (overduePlan.overduePlanCount > 0) {
    alerts.push({
      level: "P1",
      text: `Прострочені платежі по графіку: ${overduePlan.overduePlanCount} рядк.`,
    });
  }
  if (baselineBalance < 0) {
    alerts.push({ level: "P0", text: "Від'ємний операційний залишок портфеля (cash)." });
  }
  if (riskIndex >= 70) {
    alerts.push({ level: "P0", text: "Індекс ризику портфеля у критичній зоні." });
  }
  if (alerts.length === 0) {
    alerts.push({ level: "P2", text: "Критичних сигналів не виявлено за поточними даними CRM." });
  }

  return {
    kpi,
    executive,
    objectLedger,
    objectLedgerConsolidated,
    transactions,
    categories,
    accounts,
    paymentPlan,
    saasAccounting: {
      latestIncomeAt: latestIncomeStr,
      overduePlanAmount: overduePlan.overduePlanAmount,
      overduePlanCount: overduePlan.overduePlanCount,
      cashRunwayDays: Math.max(0, cashRunwayDays),
      procurementCoveragePct: Number(coveragePct.toFixed(1)),
      topSupplierConcentrationPct: Number(topSupplierShare.toFixed(1)),
      openPayables: executive.payables,
      receivablesByBucket,
      payablesByBucket,
      projectHealth,
      projectNameById: Object.fromEntries(projects.map((p) => [p.id, `${p.code} · ${p.title}`])),
      arLedger,
      apLedger,
      cashflowForecast8w,
      riskIndex,
      riskLabel,
    },
    financeAlerts: alerts,
  };
}

export async function loadFinanceProjectDetail(dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      title: true,
      value: true,
      expectedCloseDate: true,
      clientId: true,
      ownerId: true,
      client: { select: { id: true, name: true } },
      projects: { select: { id: true, code: true, title: true } },
    },
  });
  if (!deal) return null;

  const referenceDay = new Date().toISOString().slice(0, 10);

  const [moneyTx, financeTx, payrollRows, commissionRows, paymentPlanDb, procurementItemRows, purchaseOrderRows] =
    await Promise.all([
      prisma.moneyTransaction.findMany({
        where: { dealId },
        select: {
          id: true,
          dealId: true,
          type: true,
          category: true,
          amount: true,
          currency: true,
          status: true,
          paidAt: true,
          createdAt: true,
          description: true,
          createdById: true,
        },
      }),
      prisma.financeTransaction.findMany({
        where: { dealId },
        select: { id: true, dealId: true, type: true, amount: true, date: true, status: true, category: true },
      }),
      prisma.payrollEntry.findMany({
        where: { dealId },
        select: { id: true, dealId: true, employeeId: true, amount: true, type: true, status: true },
      }),
      prisma.commission.findMany({
        where: { dealId },
        select: { id: true, dealId: true, userId: true, amount: true, percent: true, status: true },
      }),
      prisma.paymentPlanEntry.findMany({
        where: { dealId },
        select: { id: true, dealId: true, amount: true, remainingAmount: true, dueDate: true, status: true },
      }),
      prisma.procurementRequestItem.findMany({
        where: { request: { dealId } },
        select: {
          id: true,
          requestId: true,
          name: true,
          costPlanned: true,
          costActual: true,
          status: true,
          request: { select: { dealId: true } },
        },
      }),
      prisma.purchaseOrder.findMany({
        where: { dealId },
        select: { id: true, dealId: true, totalAmount: true, status: true, expectedDate: true, createdAt: true },
      }),
    ]);

  const categories = FINANCE_CATEGORY_CATALOG;
  const moneyUi = moneyTx.map(moneyTxToUi);
  const financeUi = financeTx.map(financeTxToUi);
  const payrollUi = mapPayrollRows(payrollRows);
  const commissionUi = mapCommissionRows(commissionRows);
  const payrollAsTx: FinanceTransaction[] = payrollRows.map((p) => ({
    id: `pe-${p.id}`,
    projectId: p.dealId,
    objectId: null,
    type: "PAYROLL",
    categoryId: "fc-011",
    accountId: "fa-002",
    counterpartyType: "EMPLOYEE",
    counterpartyId: p.employeeId,
    amount: moneyFromDb(p.amount),
    currency: "UAH",
    transactionDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "",
    documentNumber: "",
    status: p.status === "PAID" ? "CONFIRMED" : "DRAFT",
    comment: p.type,
    createdById: null,
  }));
  const commissionAsTx: FinanceTransaction[] = commissionRows.map((c) => ({
    id: `cm-${c.id}`,
    projectId: c.dealId,
    objectId: null,
    type: "COMMISSION",
    categoryId: "fc-012",
    accountId: "fa-002",
    counterpartyType: "PARTNER",
    counterpartyId: c.userId,
    amount: moneyFromDb(c.amount),
    currency: "UAH",
    transactionDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "",
    documentNumber: "",
    status: c.status === "PAID" ? "CONFIRMED" : "DRAFT",
    comment: "",
    createdById: null,
  }));
  const transactions = [...moneyUi, ...financeUi, ...payrollAsTx, ...commissionAsTx].sort((a, b) =>
    b.transactionDate.localeCompare(a.transactionDate),
  );

  const project: Project = {
    id: deal.id,
    code: deal.projects[0]?.code?.trim() || deal.id.slice(0, 8),
    title: deal.title,
    clientId: deal.clientId,
    managerId: deal.ownerId,
    status: "IN_WORK",
    contractAmount: moneyFromDb(deal.value),
    currency: "UAH",
    plannedMargin: null,
    actualMargin: null,
    startDate: null,
    dueDate: deal.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
    notes: "",
  };

  const paymentPlan = mapPaymentPlanRows(paymentPlanDb);
  const procurementItems = mapProcurementItems(procurementItemRows);
  const purchaseOrdersUi = mapPurchaseOrders(purchaseOrderRows);
  const emptyPoItems: PurchaseOrderItem[] = [];

  const summary = calculateProjectSummary(
    project,
    paymentPlan,
    transactions,
    payrollUi,
    commissionUi,
    procurementItems,
    purchaseOrdersUi,
    emptyPoItems,
    categories,
    referenceDay,
  );

  const objects: ProjectObject[] =
    deal.projects.length === 0
      ? [
          {
            id: `${deal.id}-default-obj`,
            projectId: deal.id,
            title: deal.title,
            objectType: "Об'єкт",
            address: "—",
            notes: "",
          },
        ]
      : deal.projects.map((p) => ({
          id: p.id,
          projectId: deal.id,
          title: p.title?.trim() || "Об'єкт",
          objectType: "Адреса",
          address: p.code?.trim() || "—",
          notes: "",
        }));

  return {
    project,
    summary,
    objects,
    paymentPlan,
    incomes: moneyUi.filter((t) => t.type === "INCOME"),
    expenses: moneyUi.filter((t) => t.type === "EXPENSE"),
    payroll: payrollUi,
    commissions: commissionUi,
    transactions,
    clientName: deal.client?.name ?? "—",
  };
}
