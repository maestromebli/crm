import { prisma } from "@/lib/prisma";
import { moneyFromDb } from "@/lib/finance/money";

export type RiskLevel = "low" | "medium" | "high";

export type DealFinancialSummary = {
  contractAmount: number;
  receivedAmount: number;
  remainingToReceive: number;
  estimatedCost: number;
  procurementPlanned: number;
  procurementActual: number;
  operatingExpenses: number;
  payrollTotal: number;
  commissionsTotal: number;
  grossProfit: number;
  netProfit: number;
  marginPercent: number;
  cashGap: number;
  riskLevel: RiskLevel;
};

export type DealFinancialBreakdown = {
  summary: DealFinancialSummary;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    date: string;
    status: string;
    category: string;
  }>;
  expenses: Array<{
    id: string;
    amount: number;
    date: string;
    status: string;
    category: string;
    title: string;
  }>;
  procurement: Array<{
    id: string;
    source: string;
    status: string;
    amountPlanned: number;
    amountActual: number;
    neededByDate: string | null;
  }>;
  payroll: Array<{
    id: string;
    employeeId: string;
    amount: number;
    type: string;
    status: string;
  }>;
  commissions: Array<{
    id: string;
    userId: string;
    amount: number;
    percent: number | null;
    status: string;
  }>;
};

const n = moneyFromDb;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function riskFromSummary(s: Omit<DealFinancialSummary, "riskLevel">): RiskLevel {
  if (s.cashGap > s.contractAmount * 0.2 || s.marginPercent < 10) return "high";
  if (s.cashGap > 0 || s.marginPercent < 20) return "medium";
  return "low";
}

export async function loadDealFinancialBreakdown(
  dealId: string,
): Promise<DealFinancialBreakdown | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, value: true },
  });
  if (!deal) return null;

  const [
    incomeTx,
    plannedFinanceExpenses,
    operatingExpenses,
    payrollEntries,
    commissions,
    procurementRequests,
    purchaseOrders,
    legacyPurchaseOrders,
    latestEstimate,
  ] = await Promise.all([
    prisma.moneyTransaction.findMany({
      where: { dealId, type: "INCOME" },
      orderBy: { paidAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        paidAt: true,
        createdAt: true,
        status: true,
        category: true,
      },
    }),
    prisma.financeTransaction.findMany({
      where: { dealId, type: "EXPENSE" },
      orderBy: { date: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        date: true,
        status: true,
        category: true,
      },
    }),
    prisma.operatingExpense.findMany({
      where: { dealId },
      orderBy: { expenseDate: "desc" },
      select: {
        id: true,
        title: true,
        category: true,
        amountActual: true,
        amountPlanned: true,
        status: true,
        expenseDate: true,
      },
    }),
    prisma.payrollEntry.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        employeeId: true,
        amount: true,
        type: true,
        status: true,
      },
    }),
    prisma.commission.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        amount: true,
        percent: true,
        status: true,
      },
    }),
    prisma.procurementRequest.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        source: true,
        status: true,
        neededByDate: true,
        items: {
          select: {
            costPlanned: true,
            costActual: true,
          },
        },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      select: { id: true, totalAmount: true, status: true },
    }),
    prisma.dealPurchaseOrder.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      select: { id: true, total: true, status: true },
    }),
    prisma.estimate.findFirst({
      where: { dealId },
      orderBy: { version: "desc" },
      select: {
        lineItems: {
          select: { amountCost: true },
        },
      },
    }),
  ]);

  const contractAmount = n(deal.value);
  const receivedAmount = incomeTx
    .filter((tx) => tx.status === "PAID")
    .reduce((acc, tx) => acc + n(tx.amount), 0);
  const remainingToReceive = Math.max(contractAmount - receivedAmount, 0);
  const estimatedCost =
    latestEstimate?.lineItems.reduce((acc, li) => acc + n(li.amountCost), 0) ?? 0;
  const procurementPlanned = procurementRequests.reduce(
    (acc, req) => acc + req.items.reduce((s, it) => s + n(it.costPlanned), 0),
    0,
  );
  const procurementActual =
    purchaseOrders
      .filter((po) =>
        po.status === "CONFIRMED" ||
        po.status === "PARTIAL" ||
        po.status === "DELIVERED" ||
        po.status === "CLOSED",
      )
      .reduce((acc, po) => acc + n(po.totalAmount), 0) +
    legacyPurchaseOrders
      .filter((po) => po.status === "ORDERED" || po.status === "DELIVERED")
      .reduce((acc, po) => acc + n(po.total), 0);
  const operatingExpensesTotal = operatingExpenses.reduce(
    (acc, e) => acc + n(e.amountActual ?? e.amountPlanned),
    0,
  );
  const financeExpenses = plannedFinanceExpenses
    .filter((tx) => tx.status !== "CANCELLED")
    .reduce((acc, tx) => acc + n(tx.amount), 0);
  const payrollTotal = payrollEntries.reduce((acc, p) => acc + n(p.amount), 0);
  const commissionsTotal = commissions.reduce((acc, c) => acc + n(c.amount), 0);

  const grossProfit =
    contractAmount - procurementActual - operatingExpensesTotal - financeExpenses;
  const netProfit = grossProfit - payrollTotal - commissionsTotal;
  const marginPercent = contractAmount > 0 ? (netProfit / contractAmount) * 100 : 0;
  const cashGap = Math.max(
    procurementActual + operatingExpensesTotal + payrollTotal + commissionsTotal - receivedAmount,
    0,
  );

  const baseSummary = {
    contractAmount: round2(contractAmount),
    receivedAmount: round2(receivedAmount),
    remainingToReceive: round2(remainingToReceive),
    estimatedCost: round2(estimatedCost),
    procurementPlanned: round2(procurementPlanned),
    procurementActual: round2(procurementActual),
    operatingExpenses: round2(operatingExpensesTotal + financeExpenses),
    payrollTotal: round2(payrollTotal),
    commissionsTotal: round2(commissionsTotal),
    grossProfit: round2(grossProfit),
    netProfit: round2(netProfit),
    marginPercent: round2(marginPercent),
    cashGap: round2(cashGap),
  };

  const summary: DealFinancialSummary = {
    ...baseSummary,
    riskLevel: riskFromSummary(baseSummary),
  };

  return {
    summary,
    payments: incomeTx.map((tx) => ({
      id: tx.id,
      amount: n(tx.amount),
      currency: tx.currency,
      date: (tx.paidAt ?? tx.createdAt).toISOString(),
      status: tx.status,
      category: tx.category,
    })),
    expenses: [
      ...plannedFinanceExpenses.map((tx) => ({
        id: tx.id,
        amount: n(tx.amount),
        date: tx.date.toISOString(),
        status: tx.status,
        category: tx.category,
        title: "Finance transaction",
      })),
      ...operatingExpenses.map((exp) => ({
        id: exp.id,
        amount: n(exp.amountActual ?? exp.amountPlanned),
        date: exp.expenseDate.toISOString(),
        status: exp.status,
        category: exp.category,
        title: exp.title,
      })),
    ],
    procurement: procurementRequests.map((req) => ({
      id: req.id,
      source: req.source,
      status: req.status,
      amountPlanned: round2(req.items.reduce((acc, item) => acc + n(item.costPlanned), 0)),
      amountActual: round2(req.items.reduce((acc, item) => acc + n(item.costActual), 0)),
      neededByDate: req.neededByDate?.toISOString() ?? null,
    })),
    payroll: payrollEntries.map((p) => ({
      id: p.id,
      employeeId: p.employeeId,
      amount: n(p.amount),
      type: p.type,
      status: p.status,
    })),
    commissions: commissions.map((c) => ({
      id: c.id,
      userId: c.userId,
      amount: n(c.amount),
      percent: c.percent ? n(c.percent) : null,
      status: c.status,
    })),
  };
}
